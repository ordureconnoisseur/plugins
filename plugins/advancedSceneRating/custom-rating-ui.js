// Based on stashapp-plugin-advanced-scene-ratings by shackofnoreturn
// Original: https://github.com/shackofnoreturn/stashapp-plugin-advanced-scene-ratings
// License: AGPL v3 - https://www.gnu.org/licenses/agpl-3.0.html

(function () {
    const PLUGIN_ID = "advancedSceneRating";
    const TAG_SUFFIX = " ★";
    const CATEGORY_PATTERN = /^(.+?)\s*:\s*([0-5])$/;
    let pollTimer = null;

    /* ── Defaults & descriptions ─────────────────────────────────────── */
    const DEFAULT_GROUPS = [
        { id: "overall", name: "Overall", weight: 1 },
    ];
    const DEFAULT_CRITERIA = [
        { id: "production_quality", name: "Production Quality", group: "overall", weight: 1, enabled: true },
        { id: "chemistry",          name: "Chemistry",          group: "overall", weight: 1, enabled: true },
        { id: "performance",        name: "Performance",        group: "overall", weight: 1, enabled: true },
        { id: "aesthetics",         name: "Aesthetics",         group: "overall", weight: 1, enabled: true },
        { id: "creativity",         name: "Creativity",         group: "overall", weight: 1, enabled: true },
    ];
    const LEGACY_DISABLE_KEYS = {
        production_quality: "disable_production_quality",
        chemistry: "disable_chemistry",
        performance: "disable_performance",
        aesthetics: "disable_aesthetics",
        creativity: "disable_creativity",
    };
    const DESCRIPTIONS = {
        production_quality: "Evaluates technical execution: video resolution (4K/8K), lighting illuminating bodies and genital details, camera angles/movement capturing penetration, oral, and close-ups, audio clarity of moans, breathing, and dialogue, smooth editing, and overall polish.",
        chemistry: "Measures visible attraction and interaction: focuses on eye contact, authentic kissing, responsive touching, and the sense that performers are genuinely engaged during oral, penetration, and foreplay.",
        performance: "Assesses performers' energy and engagement: intensity and realism of moans and expressions, stamina during extended penetration, visible physical reactions (muscle contractions, wetness, erection quality), and commitment to sexual acts.",
        aesthetics: "Covers physical attractiveness (body shape, grooming of genitals/pubic areas), visual presentation of breasts, buttocks, penises, and vulvas, variety of positions, and framing of penetration and bodily fluids.",
        creativity: "Evaluates originality of concept and storyline, variety and combination of sexual acts and kinks, innovative use of positions, toys, locations, or camera work, pacing and progression of the sexual sequence, and the scene's raw physical intensity, memorability, rewatch value, and erotic impact.",
    };

    /* ── GraphQL ─────────────────────────────────────────────────────── */
    async function gqlClient(query, variables) {
        const res = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        return res.json();
    }

    async function getPluginConfig() {
        const res = await gqlClient(`query Configuration { configuration { plugins } }`);
        try { return res.data.configuration.plugins[PLUGIN_ID] || {}; }
        catch (e) { return {}; }
    }

    async function configurePlugin(input) {
        return gqlClient(`mutation ConfigurePlugin($plugin_id: ID!, $input: Map!) {
            configurePlugin(plugin_id: $plugin_id, input: $input)
        }`, { plugin_id: PLUGIN_ID, input });
    }

    const STAR_PRECISION_MAP = { FULL: 20, HALF: 10, QUARTER: 5, TENTH: 1 };
    const STAR_PRECISION_LABEL = { 20: "Full star", 10: "Half star", 5: "Quarter star", 1: "Tenth star" };

    async function getStashRatingInfo() {
        try {
            const res = await gqlClient(`{ configuration { ui } }`);
            const ui = (res.data && res.data.configuration && res.data.configuration.ui) || {};
            const rso = ui.ratingSystemOptions || {};
            const type = (rso.type || "").toUpperCase();
            const sp = (rso.starPrecision || "").toUpperCase();
            if (type === "DECIMAL") return { precision: 1, label: "Decimal (10-point)" };
            const precision = STAR_PRECISION_MAP[sp] || 20;
            return { precision, label: STAR_PRECISION_LABEL[precision] || ("Stars (" + precision + ")") };
        } catch (e) {
            return { precision: 20, label: "Full star (default)" };
        }
    }

    /* ── Criteria / Groups config helpers ────────────────────────────── */
    function coerceBool(v, def) {
        if (typeof v === "boolean") return v;
        if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
        if (typeof v === "number") return v !== 0;
        return def;
    }
    function coerceFloat(v, def) {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : def;
    }

    function groupsFromConfig(config) {
        const raw = config.apr_group_ids;
        if (typeof raw === "string" && raw.trim()) {
            const ids = raw.split(",").map(s => s.trim()).filter(Boolean);
            const result = ids.map(id => {
                const def = DEFAULT_GROUPS.find(d => d.id === id);
                return {
                    id,
                    name: config[`apr_group_name_${id}`] || (def ? def.name : id),
                    weight: coerceFloat(config[`apr_group_weight_${id}`], def ? def.weight : 1),
                };
            });
            if (result.length) return result;
        }
        return DEFAULT_GROUPS.map(d => Object.assign({}, d));
    }

    function criteriaFromConfig(config, groups) {
        const validGroupIds = new Set(groups.map(g => g.id));
        const fallbackGroup = groups[0] ? groups[0].id : "overall";

        const raw = config.apr_criteria_ids;
        if (typeof raw === "string" && raw.trim()) {
            const ids = raw.split(",").map(s => s.trim()).filter(Boolean);
            return ids.map(id => {
                const def = DEFAULT_CRITERIA.find(d => d.id === id);
                const cfgGroup = config[`apr_group_${id}`];
                const group = validGroupIds.has(cfgGroup)
                    ? cfgGroup
                    : (def && validGroupIds.has(def.group) ? def.group : fallbackGroup);
                return {
                    id,
                    name: config[`apr_name_${id}`] || (def ? def.name : id),
                    group,
                    weight: coerceFloat(config[`apr_weight_${id}`], def ? def.weight : 1),
                    enabled: coerceBool(config[`apr_enabled_${id}`], def ? def.enabled : true),
                    description: typeof config[`apr_desc_${id}`] === "string"
                        ? config[`apr_desc_${id}`]
                        : (DESCRIPTIONS[id] || ""),
                };
            });
        }
        return DEFAULT_CRITERIA.map(d => ({
            id: d.id,
            name: d.name,
            group: validGroupIds.has(d.group) ? d.group : fallbackGroup,
            weight: d.weight,
            enabled: d.enabled && !coerceBool(config[LEGACY_DISABLE_KEYS[d.id]], false),
            description: DESCRIPTIONS[d.id] || "",
        }));
    }

    function configFromState(groups, criteria) {
        const input = {
            apr_group_ids: groups.map(g => g.id).join(","),
            apr_criteria_ids: criteria.map(c => c.id).join(","),
        };
        groups.forEach(g => {
            input[`apr_group_name_${g.id}`] = g.name;
            input[`apr_group_weight_${g.id}`] = String(g.weight);
        });
        criteria.forEach(c => {
            input[`apr_name_${c.id}`] = c.name;
            input[`apr_group_${c.id}`] = c.group;
            input[`apr_weight_${c.id}`] = String(c.weight);
            input[`apr_enabled_${c.id}`] = !!c.enabled;
            input[`apr_desc_${c.id}`] = c.description || "";
        });
        return input;
    }

    function tagPrefix(criterion) { return `${criterion.name}${TAG_SUFFIX}`; }

    /* ─────────────────────────────────────────────────────────────────
       SCENE PAGE: rating modal trigger + modal (existing feature)
       ───────────────────────────────────────────────────────────────── */
    function tryInject(sceneId) {
        if (document.querySelector('#adv-rating-trigger')) return true;
        // .rating-stars is stars-mode; .rating-number is decimal-mode.
        const anchor = document.querySelector('.scene-toolbar .rating-stars, .scene-toolbar .rating-number');
        if (anchor) {
            injectTrigger(anchor, sceneId);
            return true;
        }
        return false;
    }

    function startPolling(sceneId) {
        if (pollTimer) clearInterval(pollTimer);
        let attempts = 0;
        pollTimer = setInterval(() => {
            attempts++;
            if (tryInject(sceneId) || attempts >= 40) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }, 100);
    }

    let lastPath = null;
    function onLocationChange() {
        const urlMatch = window.location.pathname.match(/\/scenes\/(\d+)/);
        if (urlMatch && !window.location.pathname.includes('edit')) {
            const sceneId = urlMatch[1];
            if (window.location.pathname !== lastPath) {
                lastPath = window.location.pathname;
                const existing = document.querySelector('#adv-rating-trigger');
                if (existing) existing.remove();
                startPolling(sceneId);
            }
        } else {
            lastPath = null;
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            const existing = document.querySelector('#adv-rating-trigger');
            if (existing) existing.remove();
        }
    }

    PluginApi.Event.addEventListener('stash:location', onLocationChange);
    onLocationChange();

    async function getEnabledCriteria() {
        const config = await getPluginConfig();
        const groups = groupsFromConfig(config);
        return criteriaFromConfig(config, groups).filter(c => c.enabled);
    }

    async function getRatingModel() {
        const config = await getPluginConfig();
        const groups = groupsFromConfig(config);
        const criteria = criteriaFromConfig(config, groups).filter(c => c.enabled);
        return { groups, criteria };
    }

    function computeBreakdown(sceneTags, groups, criteria, ratingPrecision) {
        const byPrefix = {};
        criteria.forEach(c => { byPrefix[tagPrefix(c)] = c; });
        // Legacy fallback: also accept unsuffixed tag names.
        if (TAG_SUFFIX) {
            criteria.forEach(c => { if (byPrefix[c.name] === undefined) byPrefix[c.name] = c; });
        }
        const scoresByCriterion = {};
        for (const tag of sceneTags) {
            const m = (tag.name || "").match(CATEGORY_PATTERN);
            if (!m) continue;
            const c = byPrefix[m[1].trim()];
            if (!c) continue;
            scoresByCriterion[c.id] = parseInt(m[2], 10);
        }
        const groupRows = groups.map(g => {
            const groupCriteria = criteria.filter(c => c.group === g.id);
            const ratedCriteria = groupCriteria.filter(c => scoresByCriterion[c.id] !== undefined);
            const totalWeight = ratedCriteria.reduce((n, c) => n + (parseFloat(c.weight) || 0), 0);
            const weightedSum = ratedCriteria.reduce((n, c) => n + (scoresByCriterion[c.id] || 0) * (parseFloat(c.weight) || 0), 0);
            const avg = totalWeight > 0 ? weightedSum / totalWeight : null;
            return {
                group: g,
                criteriaInGroup: groupCriteria,
                rated: ratedCriteria,
                unrated: groupCriteria.filter(c => scoresByCriterion[c.id] === undefined),
                totalWeight, weightedSum, avg, scoresByCriterion,
            };
        });
        const contributingGroups = groupRows.filter(r => r.avg !== null && (parseFloat(r.group.weight) || 0) > 0);
        const totalGroupWeight = contributingGroups.reduce((n, r) => n + (parseFloat(r.group.weight) || 0), 0);
        const finalAvg = totalGroupWeight > 0
            ? contributingGroups.reduce((n, r) => n + r.avg * (parseFloat(r.group.weight) || 0), 0) / totalGroupWeight
            : null;
        let rating100 = null;
        if (finalAvg !== null) {
            const precision = Math.max(1, parseInt(ratingPrecision, 10) || 10);
            rating100 = Math.round(Math.round(finalAvg * 20 / precision) * precision);
            rating100 = Math.max(precision, Math.min(100, rating100));
        }
        const totalCriteria = criteria.length;
        const totalRated = Object.keys(scoresByCriterion).length;
        return {
            groupRows, contributingGroups, totalGroupWeight, finalAvg, rating100,
            totalCriteria, totalRated, totalUnrated: totalCriteria - totalRated,
            scoresByCriterion,
        };
    }

    async function getSceneTags(sceneId) {
        const res = await gqlClient(`query FindScene($id: ID!) { findScene(id: $id) { id tags { id name } } }`, { id: sceneId });
        return res.data.findScene.tags;
    }

    async function getTagIdByName(name) {
        const res = await gqlClient(`query FindTags($tag_filter: TagFilterType) {
            findTags(tag_filter: $tag_filter) { tags { id name } }
        }`, { tag_filter: { name: { value: name, modifier: "EQUALS" } } });
        const tags = res.data.findTags.tags;
        return tags.length > 0 ? tags[0].id : null;
    }

    async function updateSceneTag(sceneId, allTags, prefix, newScore) {
        const oldTags = allTags.filter(tag => {
            const match = tag.name.match(CATEGORY_PATTERN);
            return match && match[1].trim() === prefix.trim();
        });
        let newTagIds = allTags.map(t => t.id).filter(id => !oldTags.find(ot => ot.id === id));
        if (newScore !== null) {
            const newTagName = `${prefix}: ${newScore}`;
            const newTagId = await getTagIdByName(newTagName);
            if (newTagId) {
                newTagIds.push(newTagId);
            } else {
                alert(`Tag "${newTagName}" not found!\n\nClick Save in the plugin settings panel to create the missing tags.`);
                return false;
            }
        }
        await gqlClient(`mutation SceneUpdate($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`,
            { input: { id: sceneId, tag_ids: newTagIds } });
        return true;
    }

    function injectTrigger(ratingStars, sceneId) {
        const triggerBtn = document.createElement('button');
        triggerBtn.id = 'adv-rating-trigger';
        // Wrap both glyphs in spans so themes (e.g. Refract) can
        // target the ★ and + individually. The + is rendered as an
        // SVG icon (stroke = currentColor) rather than a text glyph
        // so it centres precisely in the pill and inherits the button
        // colour without the baseline-alignment offset that text "+"
        // suffers from.
        triggerBtn.innerHTML =
            '<span class="adv-rating-btn-star" style="color:#ffc107;">★</span>' +
            '<span class="adv-rating-btn-plus">' +
                "<svg viewBox='0 0 24 24' fill='none' aria-hidden='true'>" +
                "<path d='M6 12H18M12 6V18' stroke='currentColor' " +
                    "stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>" +
                "</svg>" +
            '</span>';
        triggerBtn.title = "Open Advanced Scene Ratings";
        triggerBtn.className = 'adv-rating-btn';
        ratingStars.insertAdjacentElement('afterend', triggerBtn);
        triggerBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation(); openModal(sceneId);
        });
        annotateUnratedCount(triggerBtn, sceneId);
        injectFavouriteBtn(triggerBtn, sceneId);
    }

    /* ── Favourite button ─────────────────────────────────────────────
       Stash has no built-in "favourite" for scenes (only for performers).
       This injects a heart toggle next to the ★+ rating trigger that
       adds/removes a standalone "Favourite ★" tag on the current scene.
       The tag is auto-created with ignore_auto_tag:true on first use,
       so users get filter / smart-list support for free without
       running any plugin task. */
    function injectFavouriteBtn(anchorBtn, sceneId) {
        const btn = document.createElement('button');
        btn.id = 'adv-favourite-trigger';
        btn.className = 'adv-favourite-btn';
        btn.type = 'button';
        // Filled SVG drawn with currentColor — CSS toggles the colour
        // via the `--on` modifier when the scene is favourited.
        btn.innerHTML = "<svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>" +
            "<path d='M12 21s-7.5-4.5-10-9.5C.5 7 3.5 3 7.5 3c2 0 3.4 1 4.5 2.5C13.1 4 14.5 3 16.5 3 20.5 3 23.5 7 22 11.5 19.5 16.5 12 21 12 21z'/>" +
            "</svg>";
        btn.title = "Loading…";
        anchorBtn.insertAdjacentElement('afterend', btn);

        // Initial state pull. Reuses the same getSceneTags helper as
        // the modal so we don't double-fetch.
        getSceneTags(sceneId).then(function (tags) {
            if (!btn.isConnected) return;
            applyFavouriteState(btn, isSceneFavourite(tags));
        }).catch(function (e) {
            console.warn("[advancedSceneRating] favourite init failed", e);
        });

        btn.addEventListener('click', async function (e) {
            e.preventDefault(); e.stopPropagation();
            if (btn.dataset.busy === "1") return;
            btn.dataset.busy = "1";
            try {
                const tags = await getSceneTags(sceneId);
                const currentlyOn = isSceneFavourite(tags);
                await setSceneFavourite(sceneId, tags, !currentlyOn);
                applyFavouriteState(btn, !currentlyOn);
            } catch (err) {
                console.error("[advancedSceneRating] favourite toggle failed", err);
                alert("Failed to toggle favourite: " + err.message);
            } finally {
                btn.dataset.busy = "0";
            }
        });
    }

    const FAVOURITE_TAG_NAME = "Favourite ★";

    function isSceneFavourite(sceneTags) {
        return (sceneTags || []).some(function (t) { return t.name === FAVOURITE_TAG_NAME; });
    }

    function applyFavouriteState(btn, on) {
        btn.classList.toggle('adv-favourite-btn--on', on);
        btn.title = on ? "Remove favourite" : "Mark as favourite";
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    async function setSceneFavourite(sceneId, sceneTags, on) {
        const existingIds = (sceneTags || []).map(function (t) { return t.id; });
        if (on) {
            // findOrCreateTag is defined later in this same module — it
            // auto-creates the tag with ignore_auto_tag:true on first use.
            const { id: favId } = await findOrCreateTag(FAVOURITE_TAG_NAME, null);
            if (existingIds.indexOf(favId) !== -1) return; // already on
            const newTagIds = existingIds.concat([favId]);
            await gqlClient(
                "mutation SceneUpdate($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }",
                { input: { id: sceneId, tag_ids: newTagIds } });
        } else {
            const favTag = (sceneTags || []).find(function (t) { return t.name === FAVOURITE_TAG_NAME; });
            if (!favTag) return; // already off
            const newTagIds = existingIds.filter(function (id) { return id !== favTag.id; });
            await gqlClient(
                "mutation SceneUpdate($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }",
                { input: { id: sceneId, tag_ids: newTagIds } });
        }
    }

    /* ── Scene-card favourite buttons ────────────────────────────────
       Mirrors the scene-detail favourite toggle onto every scene-card
       thumbnail in the grid (scenes list, performer / studio / tag
       pages — anywhere .scene-card is rendered). State stays in sync
       with the scene-detail button because both write to the same
       "Favourite ★" tag.

       The "is this favourited?" check is batched: a single GraphQL
       query returns every scene currently tagged Favourite, which we
       cache as a Set<sceneId>. Per-card init becomes a Set lookup — no
       N+1 per-card queries on page load. The set is re-pulled on
       navigation so toggles made elsewhere (scene detail) are reflected
       when the user returns to a list page.
       ─────────────────────────────────────────────────────────────── */
    let favouriteIdsCache = null; /* Set<string> of favourited scene IDs */
    let cardSyncTimer = null;
    let cardObserver = null;

    async function refreshFavouriteSet() {
        try {
            const tagId = await getTagIdByName(FAVOURITE_TAG_NAME);
            if (!tagId) {
                /* Tag hasn't been created yet (no scene has ever been
                   favourited). All cards default to "off". */
                favouriteIdsCache = new Set();
                return favouriteIdsCache;
            }
            const res = await gqlClient(
                `query FindFavouriteScenes($filter: SceneFilterType) {
                    findScenes(scene_filter: $filter, filter: {per_page: -1}) {
                        scenes { id }
                    }
                }`,
                { filter: { tags: { value: [tagId], modifier: "INCLUDES_ALL" } } }
            );
            const scenes = (res.data && res.data.findScenes && res.data.findScenes.scenes) || [];
            favouriteIdsCache = new Set(scenes.map(function (s) { return s.id; }));
        } catch (e) {
            console.warn("[advancedSceneRating] could not load favourite list", e);
            if (!favouriteIdsCache) favouriteIdsCache = new Set();
        }
        return favouriteIdsCache;
    }

    function extractSceneIdFromCard(card) {
        const link = card.querySelector("a[href*='/scenes/']");
        if (!link) return null;
        const m = (link.getAttribute("href") || "").match(/\/scenes\/(\d+)/);
        return m ? m[1] : null;
    }

    function injectCardFavouriteBtn(card) {
        if (card.querySelector(":scope > .adv-favourite-card-btn")) return;
        const sceneId = extractSceneIdFromCard(card);
        if (!sceneId) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'adv-favourite-btn adv-favourite-card-btn';
        btn.dataset.sceneId = sceneId;
        btn.innerHTML = "<svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>" +
            "<path d='M12 21s-7.5-4.5-10-9.5C.5 7 3.5 3 7.5 3c2 0 3.4 1 4.5 2.5C13.1 4 14.5 3 16.5 3 20.5 3 23.5 7 22 11.5 19.5 16.5 12 21 12 21z'/>" +
            "</svg>";
        btn.title = "Mark as favourite";
        btn.setAttribute('aria-pressed', 'false');
        const isOn = favouriteIdsCache && favouriteIdsCache.has(sceneId);
        if (isOn) applyFavouriteState(btn, true);
        card.appendChild(btn);
        btn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (btn.dataset.busy === "1") return;
            btn.dataset.busy = "1";
            try {
                const tags = await getSceneTags(sceneId);
                const currentlyOn = isSceneFavourite(tags);
                await setSceneFavourite(sceneId, tags, !currentlyOn);
                applyFavouriteState(btn, !currentlyOn);
                if (favouriteIdsCache) {
                    if (!currentlyOn) favouriteIdsCache.add(sceneId);
                    else favouriteIdsCache.delete(sceneId);
                }
            } catch (err) {
                console.error("[advancedSceneRating] card favourite toggle failed", err);
                alert("Failed to toggle favourite: " + err.message);
            } finally {
                btn.dataset.busy = "0";
            }
        });
    }

    function syncCardFavouriteButtons() {
        document.querySelectorAll('.scene-card').forEach(injectCardFavouriteBtn);
    }

    function scheduleCardSync() {
        /* Debounce — React re-renders fire many mutations in quick
           succession. injectCardFavouriteBtn is idempotent (skips cards
           that already have a button) so re-running is cheap, but we
           still avoid hammering the DOM every microtask. */
        if (cardSyncTimer) return;
        cardSyncTimer = setTimeout(function () {
            cardSyncTimer = null;
            syncCardFavouriteButtons();
        }, 80);
    }

    function initCardFavouriteButtons() {
        if (cardObserver) return;
        refreshFavouriteSet().finally(syncCardFavouriteButtons);
        cardObserver = new MutationObserver(scheduleCardSync);
        cardObserver.observe(document.body, { childList: true, subtree: true });
        /* Re-pull the favourite set when navigating — keeps card state
           in sync with toggles made on the scene-detail page elsewhere. */
        PluginApi.Event.addEventListener('stash:location', function () {
            refreshFavouriteSet().finally(syncCardFavouriteButtons);
        });
    }
    initCardFavouriteButtons();

    async function annotateUnratedCount(triggerBtn, sceneId) {
        try {
            const [{ groups, criteria }, sceneTags] = await Promise.all([
                getRatingModel(),
                getSceneTags(sceneId),
            ]);
            if (!triggerBtn.isConnected) return;
            const breakdown = computeBreakdown(sceneTags, groups, criteria, 10);
            if (breakdown.totalUnrated === 0) {
                triggerBtn.title = "Open Advanced Scene Ratings — all criteria rated";
                return;
            }
            triggerBtn.classList.add('adv-rating-btn--incomplete');
            if (breakdown.totalRated > 0) {
                triggerBtn.classList.add('adv-rating-btn--partial');
                triggerBtn.title = `Open Advanced Scene Ratings — ${breakdown.totalUnrated} of ${breakdown.totalCriteria} criteria still unrated`;
            } else {
                triggerBtn.title = `Open Advanced Scene Ratings — ${breakdown.totalCriteria} criteria to rate`;
            }
            const badge = document.createElement('span');
            badge.className = 'adv-rating-btn-badge';
            badge.innerText = breakdown.totalUnrated;
            triggerBtn.appendChild(badge);
        } catch (e) {
            console.warn("[advancedSceneRating] annotate failed", e);
        }
    }

    async function openModal(sceneId) {
        if (document.querySelector('#adv-rating-modal')) return;
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'adv-rating-modal';
        modalOverlay.className = 'adv-rating-modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.className = 'adv-rating-modal-content';
        modalContent.innerHTML = `
            <div class="adv-rating-header">
                <div>
                    <h3>Advanced Ratings</h3>
                    <div class="adv-rating-subhead"></div>
                </div>
                <span class="adv-rating-close">&times;</span>
            </div>
            <div class="ratings-list">Loading…</div>
            <div class="adv-rating-breakdown"></div>
        `;
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        const handleClose = () => { modalOverlay.remove(); window.location.reload(); };
        modalContent.querySelector('.adv-rating-close').addEventListener('click', handleClose);
        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) handleClose(); });

        const { groups, criteria } = await getRatingModel();
        const precision = (await getStashRatingInfo()).precision;
        let sceneTags = await getSceneTags(sceneId);

        function render() {
            const listContainer = modalContent.querySelector('.ratings-list');
            const subhead = modalContent.querySelector('.adv-rating-subhead');
            const breakdownEl = modalContent.querySelector('.adv-rating-breakdown');
            listContainer.innerHTML = '';

            const breakdown = computeBreakdown(sceneTags, groups, criteria, precision);
            const currentScores = breakdown.scoresByCriterion;

            subhead.innerHTML = '';
            const summary = document.createElement('span');
            summary.className = 'adv-rating-summary';
            summary.innerText = `${breakdown.totalCriteria} criteria · ${breakdown.totalRated} rated`;
            if (breakdown.totalUnrated > 0) {
                summary.innerHTML += ` · <span class="adv-rating-unrated-pill">${breakdown.totalUnrated} unrated</span>`;
            }
            subhead.appendChild(summary);

            groups.forEach(g => {
                const groupCriteria = criteria.filter(c => c.group === g.id);
                if (!groupCriteria.length) return;
                // Single-group default → skip the header so the modal looks clean.
                if (groups.length > 1) {
                    const groupHeader = document.createElement('div');
                    groupHeader.className = 'adv-rating-group-header';
                    groupHeader.innerText = g.name;
                    listContainer.appendChild(groupHeader);
                }
                groupCriteria.forEach(c => {
                    const prefix = tagPrefix(c);
                    const score = currentScores[c.id] !== undefined ? currentScores[c.id] : null;
                    const row = document.createElement('div');
                    row.className = 'rating-row' + (score === null ? ' rating-unrated' : '');
                    const label = document.createElement('span'); label.className = 'rating-label';
                    const labelText = document.createElement('span'); labelText.innerText = c.name; label.appendChild(labelText);
                    if (score === null) {
                        const pill = document.createElement('span'); pill.className = 'adv-rating-unrated-pill'; pill.innerText = 'unrated';
                        label.appendChild(pill);
                    }
                    const desc = c.description;
                    if (desc) {
                        const infoIcon = document.createElement('span'); infoIcon.className = 'rating-info-icon'; infoIcon.innerHTML = 'ⓘ';
                        const tooltip = document.createElement('div'); tooltip.className = 'rating-tooltip'; tooltip.innerText = desc;
                        infoIcon.appendChild(tooltip); label.appendChild(infoIcon);
                    }
                    const starsDiv = document.createElement('div'); starsDiv.className = 'rating-stars-modal';
                    for (let i = 1; i <= 5; i++) {
                        const star = document.createElement('span'); star.className = 'rating-star';
                        star.innerHTML = (score !== null && i <= score) ? '★' : '☆';
                        star.addEventListener('mouseenter', () => {
                            starsDiv.querySelectorAll('.rating-star').forEach((s, idx) => {
                                s.classList.toggle('hovered', idx < i);
                            });
                        });
                        star.addEventListener('mouseleave', () => {
                            starsDiv.querySelectorAll('.rating-star').forEach(s => s.classList.remove('hovered'));
                        });
                        star.addEventListener('click', async () => {
                            listContainer.style.opacity = '0.5';
                            if (await updateSceneTag(sceneId, sceneTags, prefix, i)) {
                                sceneTags = await getSceneTags(sceneId); render();
                            }
                            listContainer.style.opacity = '1';
                        });
                        starsDiv.appendChild(star);
                    }
                    const clearBtn = document.createElement('span'); clearBtn.className = 'rating-clear'; clearBtn.innerHTML = '×';
                    clearBtn.title = 'Remove Category Rating';
                    clearBtn.addEventListener('click', async () => {
                        listContainer.style.opacity = '0.5';
                        if (await updateSceneTag(sceneId, sceneTags, prefix, null)) {
                            sceneTags = await getSceneTags(sceneId); render();
                        }
                        listContainer.style.opacity = '1';
                    });
                    starsDiv.appendChild(clearBtn);
                    row.appendChild(label); row.appendChild(starsDiv); listContainer.appendChild(row);
                });
            });

            renderBreakdown(breakdownEl, breakdown);
        }

        function renderBreakdown(container, b) {
            container.innerHTML = '';
            const open = localStorage.getItem('asrBreakdownOpen') === '1';
            const heading = document.createElement('button');
            heading.type = 'button';
            heading.className = 'adv-rating-breakdown-heading' + (open ? ' open' : '');
            heading.innerHTML = `<span class="adv-rating-breakdown-caret">▶</span>Score breakdown`;
            container.appendChild(heading);

            const body = document.createElement('div');
            body.className = 'adv-rating-breakdown-body' + (open ? ' open' : '');
            container.appendChild(body);

            heading.addEventListener('click', () => {
                const nowOpen = !heading.classList.contains('open');
                heading.classList.toggle('open', nowOpen);
                body.classList.toggle('open', nowOpen);
                localStorage.setItem('asrBreakdownOpen', nowOpen ? '1' : '0');
            });

            if (b.totalRated === 0) {
                const empty = document.createElement('div');
                empty.className = 'adv-rating-breakdown-empty';
                empty.innerText = 'Rate at least one criterion to see the calculation.';
                body.appendChild(empty);
                return;
            }
            b.groupRows.forEach(row => {
                if (!row.criteriaInGroup.length) return;
                const groupBlock = document.createElement('div');
                groupBlock.className = 'adv-rating-breakdown-group';
                const head = document.createElement('div');
                head.className = 'adv-rating-breakdown-group-head';
                const name = document.createElement('span');
                name.className = 'adv-rating-breakdown-name';
                name.innerText = row.group.name;
                head.appendChild(name);
                const weightBadge = document.createElement('span');
                weightBadge.className = 'adv-rating-breakdown-weight';
                weightBadge.innerText = 'group weight: ' + row.group.weight;
                head.appendChild(weightBadge);
                groupBlock.appendChild(head);
                if (row.rated.length === 0) {
                    const noScore = document.createElement('div');
                    noScore.className = 'adv-rating-breakdown-empty';
                    noScore.innerText = 'No rated criteria in this group — skipped.';
                    groupBlock.appendChild(noScore);
                } else {
                    const terms = row.rated.map(c => `${row.scoresByCriterion[c.id]}×${c.weight}`);
                    const formula = document.createElement('div');
                    formula.className = 'adv-rating-breakdown-formula';
                    formula.innerHTML = `(${terms.join(' + ')}) ÷ ${row.totalWeight} = <b>${row.avg.toFixed(2)}</b>`;
                    groupBlock.appendChild(formula);
                    if (row.unrated.length) {
                        const note = document.createElement('div');
                        note.className = 'adv-rating-breakdown-note';
                        note.innerText = `${row.unrated.length} unrated: ${row.unrated.map(c => c.name).join(', ')}`;
                        groupBlock.appendChild(note);
                    }
                }
                body.appendChild(groupBlock);
            });
            const finalBlock = document.createElement('div');
            finalBlock.className = 'adv-rating-breakdown-final';
            if (b.contributingGroups.length && b.finalAvg !== null) {
                const finalTerms = b.contributingGroups.map(r => `${r.avg.toFixed(2)}×${r.group.weight}`);
                finalBlock.innerHTML = `<b>Final:</b> (${finalTerms.join(' + ')}) ÷ ${b.totalGroupWeight} = <b>${b.finalAvg.toFixed(2)}</b>/5 → <b>${b.rating100}</b>/100`;
            } else {
                finalBlock.innerText = 'No contributing groups — rating not updated.';
            }
            body.appendChild(finalBlock);
        }

        render();
    }

    /* ── Tag CRUD ────────────────────────────────────────────────────── */
    const RATING_ROOT_TAG = "Advanced Rating System";

    async function findOrCreateTag(name, parentId) {
        let id = await getTagIdByName(name);
        if (id) return { id, created: false };
        const createRes = await gqlClient(`mutation TagCreate($input: TagCreateInput!) {
            tagCreate(input: $input) { id }
        }`, { input: { name, ignore_auto_tag: true, parent_ids: parentId ? [parentId] : [] } });
        id = createRes.data && createRes.data.tagCreate && createRes.data.tagCreate.id;
        if (!id) throw new Error("Failed to create tag: " + name);
        return { id, created: true };
    }

    async function destroyTagByName(name) {
        const id = await getTagIdByName(name);
        if (!id) return false;
        await gqlClient(`mutation TagDestroy($input: TagDestroyInput!) {
            tagDestroy(input: $input)
        }`, { input: { id } });
        return true;
    }

    async function createMissingTags(criteria) {
        const enabled = criteria.filter(c => c.enabled);
        if (!enabled.length) return { createdParent: false, createdCategories: 0, createdLevels: 0 };
        const root = await findOrCreateTag(RATING_ROOT_TAG, null);
        let createdCategories = 0, createdLevels = 0;
        for (const c of enabled) {
            const prefix = tagPrefix(c);
            const cat = await findOrCreateTag(prefix, root.id);
            if (cat.created) createdCategories++;
            for (let i = 0; i <= 5; i++) {
                const lvl = await findOrCreateTag(`${prefix}: ${i}`, cat.id);
                if (lvl.created) createdLevels++;
            }
        }
        return { createdParent: root.created, createdCategories, createdLevels };
    }

    async function findOrphanCriterionTags(criteria) {
        const parentId = await getTagIdByName(RATING_ROOT_TAG);
        if (!parentId) return { parentMissing: true, orphans: [] };
        const res = await gqlClient(`query($filter: TagFilterType) {
            findTags(tag_filter: $filter, filter: {per_page: -1}) {
                tags { id name children { id name } }
            }
        }`, { filter: { parents: { value: [parentId], modifier: "INCLUDES" } } });
        const tags = (res.data && res.data.findTags && res.data.findTags.tags) || [];
        const currentPrefixes = new Set(criteria.map(c => tagPrefix(c)));
        const orphans = tags
            .filter(t => !currentPrefixes.has(t.name))
            .map(t => ({ id: t.id, name: t.name, childCount: (t.children || []).length }));
        return { parentMissing: false, orphans };
    }

    async function destroyOrphanSubtrees(orphans) {
        let destroyed = 0;
        for (const t of orphans) {
            for (let i = 0; i <= 5; i++) {
                if (await destroyTagByName(`${t.name}: ${i}`)) destroyed++;
            }
            try {
                await gqlClient(`mutation TagDestroy($input: TagDestroyInput!) {
                    tagDestroy(input: $input)
                }`, { input: { id: t.id } });
                destroyed++;
            } catch (e) { console.warn("[advancedSceneRating] destroy failed", t.name, e); }
        }
        return destroyed;
    }

    async function destroyAllRatingTags(criteria) {
        let destroyed = 0;
        for (const c of criteria) {
            const prefix = tagPrefix(c);
            for (let i = 0; i <= 5; i++) {
                if (await destroyTagByName(`${prefix}: ${i}`)) destroyed++;
            }
            if (await destroyTagByName(prefix)) destroyed++;
        }
        if (await destroyTagByName(RATING_ROOT_TAG)) destroyed++;
        return destroyed;
    }

    async function renameRatingTags(oldPrefix, newPrefix) {
        const targets = [oldPrefix];
        for (let i = 0; i <= 5; i++) targets.push(oldPrefix + ": " + i);
        let renamedAny = false;
        for (const oldName of targets) {
            const id = await getTagIdByName(oldName);
            if (!id) continue;
            const suffix = oldName.slice(oldPrefix.length);
            const newName = newPrefix + suffix;
            try {
                await gqlClient(`mutation TagUpdate($input: TagUpdateInput!) {
                    tagUpdate(input: $input) { id name }
                }`, { input: { id, name: newName } });
                renamedAny = true;
            } catch (e) { console.warn("[advancedSceneRating] rename failed", oldName, "→", newName, e); }
        }
        return { renamedAny };
    }

    /* ── Rating math (mirrors advancedSceneRating.py) ────────────────── */
    function computeRating100(sceneTags, groups, criteria, ratingPrecision, minimumRequired) {
        const enabled = criteria.filter(c => c.enabled);
        if (!enabled.length) return null;
        const byPrefix = {};
        enabled.forEach(c => { byPrefix[tagPrefix(c)] = c; });
        // Backward-compat with pre-v2.3.1 unsuffixed tag names.
        if (TAG_SUFFIX) {
            enabled.forEach(c => {
                if (byPrefix[c.name] === undefined) byPrefix[c.name] = c;
            });
        }
        const hitsByGroup = {};
        groups.forEach(g => { hitsByGroup[g.id] = []; });
        for (const tag of sceneTags) {
            const m = (tag.name || "").match(CATEGORY_PATTERN);
            if (!m) continue;
            const c = byPrefix[m[1].trim()];
            if (!c) continue;
            const bucket = hitsByGroup[c.group];
            if (!bucket) continue;
            bucket.push({ score: parseInt(m[2], 10), w: parseFloat(c.weight) || 0 });
        }
        const totalHits = Object.values(hitsByGroup).reduce((n, arr) => n + arr.length, 0);
        if (totalHits < minimumRequired) return null;
        const contributions = [];
        for (const g of groups) {
            const hits = hitsByGroup[g.id] || [];
            const wsum = hits.reduce((n, h) => n + h.w, 0);
            if (wsum <= 0) continue;
            const gavg = hits.reduce((n, h) => n + h.score * h.w, 0) / wsum;
            const gw = parseFloat(g.weight) || 0;
            if (gw <= 0) continue;
            contributions.push({ avg: gavg, w: gw });
        }
        if (!contributions.length) return null;
        const totalW = contributions.reduce((n, c) => n + c.w, 0);
        const finalAvg = contributions.reduce((n, c) => n + c.avg * c.w, 0) / totalW;
        const precision = Math.max(1, parseInt(ratingPrecision, 10) || 10);
        let r100 = Math.round(Math.round(finalAvg * 20 / precision) * precision);
        r100 = Math.max(precision, Math.min(100, r100));
        return r100;
    }

    async function recalculateAllScenes(groups, criteria, onProgress) {
        const info = await getStashRatingInfo();
        const ratingPrecision = info.precision;
        const minimumRequired = 1;
        const res = await gqlClient(`{
            findScenes(filter: {per_page: -1}) {
                count
                scenes { id title rating100 tags { id name } }
            }
        }`);
        const scenes = (res.data && res.data.findScenes && res.data.findScenes.scenes) || [];
        let updated = 0, skipped = 0;
        for (let i = 0; i < scenes.length; i++) {
            const s = scenes[i];
            const newRating = computeRating100(s.tags || [], groups, criteria, ratingPrecision, minimumRequired);
            if (newRating === null || newRating === s.rating100) { skipped++; }
            else {
                await gqlClient(`mutation($input: SceneUpdateInput!) {
                    sceneUpdate(input: $input) { id }
                }`, { input: { id: s.id, rating100: newRating } });
                updated++;
            }
            if (onProgress) onProgress(i + 1, scenes.length, updated, skipped);
        }
        return { total: scenes.length, updated, skipped };
    }

    /* ─────────────────────────────────────────────────────────────────
       SETTINGS PANEL via PluginApi.patch.instead("PluginSettings")
       ───────────────────────────────────────────────────────────────── */
    function buildSettingsPanel() {
        const R = PluginApi.React;
        return function AdvSceneRatingSettings() {
            const [groups, setGroups] = R.useState(null);
            const [criteria, setCriteria] = R.useState(null);
            const [general, setGeneral] = R.useState(null);
            const [loadError, setLoadError] = R.useState(null);
            const [savingState, setSavingState] = R.useState({ saving: false, message: null, kind: null });
            const [editingDescId, setEditingDescId] = R.useState(null);

            R.useEffect(function () {
                let cancelled = false;
                Promise.all([getPluginConfig(), getStashRatingInfo()])
                    .then(function (results) {
                        if (cancelled) return;
                        const cfg = results[0];
                        const info = results[1];
                        const gs = groupsFromConfig(cfg);
                        setGroups(gs);
                        setCriteria(criteriaFromConfig(cfg, gs));
                        setGeneral({
                            allow_destructive_actions: coerceBool(cfg.allow_destructive_actions, false),
                            rating_precision: info.precision,
                            rating_precision_label: info.label,
                        });
                    })
                    .catch(function (e) {
                        if (cancelled) return;
                        setLoadError(String(e));
                    });
                return function () { cancelled = true; };
            }, []);

            function updateGeneral(patch) {
                setGeneral(function (cur) { return Object.assign({}, cur, patch); });
            }

            R.useEffect(function () {
                const interval = setInterval(async function () {
                    try {
                        const info = await getStashRatingInfo();
                        setGeneral(function (cur) {
                            if (!cur) return cur;
                            if (cur.rating_precision === info.precision && cur.rating_precision_label === info.label) return cur;
                            return Object.assign({}, cur, {
                                rating_precision: info.precision,
                                rating_precision_label: info.label,
                            });
                        });
                    } catch (e) { /* ignore */ }
                }, 3000);
                return function () { clearInterval(interval); };
            }, []);

            function updateCriterion(idx, patch) {
                setCriteria(function (cur) {
                    const next = cur.slice();
                    next[idx] = Object.assign({}, next[idx], patch);
                    return next;
                });
            }
            function removeCriterion(idx) {
                setCriteria(function (cur) { return cur.filter(function (_, i) { return i !== idx; }); });
            }
            function moveCriterion(idx, dir) {
                setCriteria(function (cur) {
                    const j = idx + dir;
                    if (j < 0 || j >= cur.length) return cur;
                    const next = cur.slice();
                    const tmp = next[idx]; next[idx] = next[j]; next[j] = tmp;
                    return next;
                });
            }
            function addCriterion() {
                setCriteria(function (cur) {
                    const id = "custom_" + Date.now().toString(36);
                    const fallbackGroup = groups[0] ? groups[0].id : "overall";
                    return cur.concat([{ id, name: "New criterion", group: fallbackGroup, weight: 1, enabled: true, description: "" }]);
                });
            }
            function updateGroup(idx, patch) {
                setGroups(function (cur) {
                    const next = cur.slice();
                    next[idx] = Object.assign({}, next[idx], patch);
                    return next;
                });
            }
            function moveGroup(idx, dir) {
                setGroups(function (cur) {
                    const j = idx + dir;
                    if (j < 0 || j >= cur.length) return cur;
                    const next = cur.slice();
                    const tmp = next[idx]; next[idx] = next[j]; next[j] = tmp;
                    return next;
                });
            }
            function addGroup() {
                setGroups(function (cur) {
                    const id = "group_" + Date.now().toString(36);
                    return cur.concat([{ id, name: "New group", weight: 1 }]);
                });
            }
            function removeGroup(idx) {
                const g = groups[idx];
                if (!g) return;
                if (groups.length <= 1) {
                    alert("At least one group is required.");
                    return;
                }
                const using = criteria.filter(function (c) { return c.group === g.id; });
                const reassignTo = (groups.find(function (other, i) { return i !== idx; }) || {}).id;
                const msg = using.length
                    ? "Remove group \"" + g.name + "\"?\n" + using.length + " criterion/criteria will be reassigned to \"" + reassignTo + "\"."
                    : "Remove group \"" + g.name + "\"?";
                if (!confirm(msg)) return;
                setGroups(function (cur) { return cur.filter(function (_, i) { return i !== idx; }); });
                if (using.length) {
                    setCriteria(function (cur) {
                        return cur.map(function (c) {
                            return c.group === g.id ? Object.assign({}, c, { group: reassignTo }) : c;
                        });
                    });
                }
            }
            function resetDefaults() {
                if (!confirm("Reset all groups and criteria to defaults?\nUnsaved edits will be lost.")) return;
                setGroups(DEFAULT_GROUPS.map(function (d) { return Object.assign({}, d); }));
                setCriteria(DEFAULT_CRITERIA.map(function (d) { return Object.assign({}, d, { description: DESCRIPTIONS[d.id] || "" }); }));
            }

            async function recalcAll() {
                if (!confirm("Recalculate ratings for all scenes? This walks every scene and updates rating100 based on the current configuration.")) return;
                setSavingState({ saving: true, message: "Loading scenes…", kind: "info" });
                try {
                    const res = await recalculateAllScenes(groups, criteria, function (done, total, updated) {
                        setSavingState({ saving: true, message: "Processed " + done + " / " + total + " (" + updated + " updated)", kind: "info" });
                    });
                    setSavingState({ saving: false, message: "Recalc complete: " + res.updated + " updated, " + res.skipped + " unchanged of " + res.total + ".", kind: "success" });
                } catch (e) {
                    setSavingState({ saving: false, message: "Recalc failed: " + (e && e.message ? e.message : e), kind: "error" });
                }
            }

            async function removeOrphans() {
                if (!general || !general.allow_destructive_actions) {
                    alert("Enable \"Allow Destructive Actions\" first.");
                    return;
                }
                setSavingState({ saving: true, message: "Scanning for orphaned tags…", kind: "info" });
                try {
                    const { parentMissing, orphans } = await findOrphanCriterionTags(criteria);
                    if (parentMissing) {
                        setSavingState({ saving: false, message: "No rating tags found — nothing to scan.", kind: "info" });
                        return;
                    }
                    if (!orphans.length) {
                        setSavingState({ saving: false, message: "No orphaned tags found.", kind: "success" });
                        return;
                    }
                    const lines = orphans.map(o => "  • " + o.name + " (+ " + o.childCount + " child tag(s))");
                    const msg = "Found " + orphans.length + " orphaned criterion tag(s):\n\n" + lines.join("\n") + "\n\nDelete these and their 0–5 children from Stash?";
                    if (!confirm(msg)) {
                        setSavingState({ saving: false, message: "Cancelled.", kind: "info" });
                        return;
                    }
                    const destroyed = await destroyOrphanSubtrees(orphans);
                    setSavingState({ saving: false, message: "Deleted " + destroyed + " orphaned tag(s).", kind: "success" });
                } catch (e) {
                    setSavingState({ saving: false, message: "Scan failed: " + (e && e.message ? e.message : e), kind: "error" });
                }
            }

            async function deleteAllTags() {
                if (!general || !general.allow_destructive_actions) {
                    alert("Enable \"Allow Destructive Actions\" first.");
                    return;
                }
                if (!confirm("Delete ALL Advanced Scene Rating tags from the database?\nThis destroys the parent + every criterion's level tags. Scenes lose their per-criterion ratings (their overall rating100 stays).\nThis cannot be undone.")) return;
                if (!confirm("Really delete? Last chance.")) return;
                setSavingState({ saving: true, message: "Deleting tags…", kind: "info" });
                try {
                    const destroyed = await destroyAllRatingTags(criteria);
                    setSavingState({ saving: false, message: "Deleted " + destroyed + " tag(s). Run Save to recreate.", kind: "success" });
                } catch (e) {
                    setSavingState({ saving: false, message: "Delete failed: " + (e && e.message ? e.message : e), kind: "error" });
                }
            }

            async function save() {
                setSavingState({ saving: true, message: "Saving…", kind: "info" });
                try {
                    if (!groups.length) throw new Error("At least one group is required");
                    const gids = groups.map(function (g) { return g.id; });
                    const gdupes = gids.filter(function (id, i) { return gids.indexOf(id) !== i; });
                    if (gdupes.length) throw new Error("Duplicate group ids: " + gdupes.join(", "));
                    const validGroupIds = new Set(gids);
                    for (const g of groups) {
                        if (!g.name || !g.name.trim()) throw new Error("Every group needs a name");
                        if (!Number.isFinite(g.weight) || g.weight < 0) throw new Error("Group weight must be a non-negative number");
                    }
                    const ids = criteria.map(function (c) { return c.id; });
                    const dupes = ids.filter(function (id, i) { return ids.indexOf(id) !== i; });
                    if (dupes.length) throw new Error("Duplicate criterion ids: " + dupes.join(", "));
                    for (const c of criteria) {
                        if (!c.name || !c.name.trim()) throw new Error("Every criterion needs a name");
                        if (!Number.isFinite(c.weight) || c.weight < 0) throw new Error("Weight must be a non-negative number");
                        if (!validGroupIds.has(c.group)) throw new Error("Criterion \"" + c.name + "\" references unknown group \"" + c.group + "\"");
                    }

                    const beforeCfg = await getPluginConfig();
                    const beforeGroups = groupsFromConfig(beforeCfg);
                    const before = criteriaFromConfig(beforeCfg, beforeGroups);
                    const renames = [];
                    for (const next of criteria) {
                        const prev = before.find(function (p) { return p.id === next.id; });
                        if (prev && prev.name.trim() !== next.name.trim()) {
                            renames.push({ from: tagPrefix(prev), to: tagPrefix(next) });
                        }
                    }

                    const configInput = configFromState(groups, criteria);
                    if (general) {
                        configInput.allow_destructive_actions = !!general.allow_destructive_actions;
                    }
                    await configurePlugin(configInput);

                    let renameSummary = "";
                    if (renames.length) {
                        let renamedCount = 0;
                        for (const rn of renames) {
                            const result = await renameRatingTags(rn.from, rn.to);
                            if (result.renamedAny) renamedCount++;
                        }
                        if (renamedCount) renameSummary = " Renamed " + renamedCount + " tag group(s).";
                    }

                    // Legacy migration: rename pre-v2.3.1 unsuffixed tags in
                    // place. Idempotent — renameRatingTags is a no-op for
                    // criteria that don't have a legacy tag to migrate.
                    let migratedCount = 0;
                    if (TAG_SUFFIX) {
                        for (const c of criteria) {
                            const legacyName = c.name;
                            const newName = tagPrefix(c);
                            if (legacyName === newName) continue;
                            const result = await renameRatingTags(legacyName, newName);
                            if (result.renamedAny) migratedCount++;
                        }
                    }
                    const migrateSummary = migratedCount ? " Migrated " + migratedCount + " legacy tag group(s)." : "";

                    const created = await createMissingTags(criteria);
                    const createPieces = [];
                    if (created.createdParent) createPieces.push("parent tag");
                    if (created.createdCategories) createPieces.push(created.createdCategories + " criterion tag(s)");
                    if (created.createdLevels) createPieces.push(created.createdLevels + " level tag(s)");
                    const createSummary = createPieces.length ? " Created " + createPieces.join(", ") + "." : "";

                    setSavingState({ saving: false, message: "Saved." + renameSummary + migrateSummary + createSummary, kind: "success" });
                } catch (e) {
                    setSavingState({ saving: false, message: "Save failed: " + (e && e.message ? e.message : e), kind: "error" });
                }
            }

            if (loadError) {
                return R.createElement("div", { className: "plugin-settings" },
                    R.createElement("div", { className: "setting" },
                        R.createElement("div", null,
                            R.createElement("h3", null, "Advanced Scene Rating"),
                            R.createElement("div", { className: "sub-heading" }, "Failed to load config: " + loadError))));
            }
            if (criteria === null || groups === null || general === null) {
                return R.createElement("div", { className: "plugin-settings" },
                    R.createElement("div", { className: "setting" },
                        R.createElement("div", null, R.createElement("h3", null, "Loading…"))));
            }

            const generalSection = [
                R.createElement("div", { key: "g-prec", className: "setting" },
                    R.createElement("div", null,
                        R.createElement("h3", null, "Rating Star Precision"),
                        R.createElement("div", { className: "sub-heading" },
                            "Auto-matched to Stash's rating system setting (Settings → Interface → Editing → Rating System). Change it there and the value here updates within a few seconds.")),
                    R.createElement("div", { className: "apr-general-control" },
                        R.createElement("span", { className: "apr-readonly" },
                            general.rating_precision_label + " (" + general.rating_precision + ")"))),
                R.createElement("div", { key: "g-destr", className: "setting" },
                    R.createElement("div", null,
                        R.createElement("h3", null, "Allow Destructive Actions"),
                        R.createElement("div", { className: "sub-heading" },
                            "Required to use \"Remove orphaned tags\" and \"Delete all rating tags\". Use with caution.")),
                    R.createElement("div", { className: "apr-general-control" },
                        R.createElement("div", { className: "custom-control custom-switch" },
                            R.createElement("input", {
                                type: "checkbox",
                                className: "custom-control-input",
                                id: "asr-allow-destr",
                                checked: !!general.allow_destructive_actions,
                                onChange: function (e) { updateGeneral({ allow_destructive_actions: e.target.checked }); },
                            }),
                            R.createElement("label", {
                                className: "custom-control-label",
                                htmlFor: "asr-allow-destr",
                            })))),
            ];

            const groupRows = groups.map(function (g, idx) {
                const usingCount = criteria.filter(function (c) { return c.group === g.id; }).length;
                return R.createElement("div", { key: g.id, className: "setting apr-group-row" },
                    R.createElement("div", { className: "apr-group-main" },
                        R.createElement("input", {
                            type: "text",
                            className: "form-control apr-group-name-input",
                            value: g.name,
                            placeholder: "Group name",
                            onChange: function (e) { updateGroup(idx, { name: e.target.value }); },
                        }),
                        R.createElement("input", {
                            type: "number",
                            className: "form-control apr-group-weight-input",
                            value: g.weight,
                            min: 0, step: 0.5,
                            title: "Group weight in the final score",
                            onChange: function (e) { updateGroup(idx, { weight: coerceFloat(e.target.value, 1) }); },
                        }),
                        R.createElement("span", { className: "apr-group-usage" },
                            usingCount + " criterion" + (usingCount === 1 ? "" : "ia")),
                        R.createElement("div", { className: "apr-row-actions" },
                            R.createElement("button", { type: "button", className: "btn btn-secondary btn-sm", title: "Move up", disabled: idx === 0, onClick: function () { moveGroup(idx, -1); } }, "↑"),
                            R.createElement("button", { type: "button", className: "btn btn-secondary btn-sm", title: "Move down", disabled: idx === groups.length - 1, onClick: function () { moveGroup(idx, 1); } }, "↓"),
                            R.createElement("button", { type: "button", className: "btn btn-danger btn-sm", title: "Delete group", disabled: groups.length <= 1, onClick: function () { removeGroup(idx); } }, "×"))));
            });

            const rows = criteria.map(function (c, idx) {
                const isEditingDesc = editingDescId === c.id;
                const previewDesc = c.description || "";
                return R.createElement("div", {
                    key: c.id,
                    className: "setting apr-criterion-row" + (c.enabled ? "" : " apr-disabled"),
                },
                    R.createElement("div", { className: "apr-criterion-main" },
                        R.createElement("div", { className: "apr-criterion-toggle" },
                            R.createElement("div", { className: "custom-control custom-switch" },
                                R.createElement("input", {
                                    type: "checkbox",
                                    className: "custom-control-input",
                                    id: "asr-enabled-" + c.id,
                                    checked: !!c.enabled,
                                    onChange: function (e) { updateCriterion(idx, { enabled: e.target.checked }); },
                                }),
                                R.createElement("label", {
                                    className: "custom-control-label",
                                    htmlFor: "asr-enabled-" + c.id,
                                }))),
                        R.createElement("input", {
                            type: "text",
                            className: "form-control apr-name-input",
                            value: c.name,
                            placeholder: "Display name",
                            onChange: function (e) { updateCriterion(idx, { name: e.target.value }); },
                        }),
                        R.createElement("select", {
                            className: "form-control apr-group-select",
                            value: c.group,
                            onChange: function (e) { updateCriterion(idx, { group: e.target.value }); },
                        }, groups.map(function (g) {
                            return R.createElement("option", { key: g.id, value: g.id }, g.name);
                        })),
                        R.createElement("input", {
                            type: "number",
                            className: "form-control apr-weight-input",
                            value: c.weight,
                            min: 0, step: 0.5,
                            onChange: function (e) { updateCriterion(idx, { weight: coerceFloat(e.target.value, 1) }); },
                        }),
                        R.createElement("div", { className: "apr-row-actions" },
                            R.createElement("button", {
                                type: "button",
                                className: "btn btn-secondary btn-sm" + (isEditingDesc ? " active" : ""),
                                title: "Edit description",
                                onClick: function () { setEditingDescId(isEditingDesc ? null : c.id); },
                            }, "✎"),
                            R.createElement("button", { type: "button", className: "btn btn-secondary btn-sm", title: "Move up", disabled: idx === 0, onClick: function () { moveCriterion(idx, -1); } }, "↑"),
                            R.createElement("button", { type: "button", className: "btn btn-secondary btn-sm", title: "Move down", disabled: idx === criteria.length - 1, onClick: function () { moveCriterion(idx, 1); } }, "↓"),
                            R.createElement("button", {
                                type: "button",
                                className: "btn btn-danger btn-sm",
                                title: "Remove criterion. Tags stay on disk — clean up with \"Remove orphaned tags\".",
                                onClick: function () {
                                    if (confirm("Remove criterion \"" + c.name + "\" from this configuration?\nIts tags stay on disk; use \"Remove orphaned tags\" later to clean them up.")) {
                                        removeCriterion(idx);
                                    }
                                },
                            }, "×"))),
                    isEditingDesc
                        ? R.createElement("div", { className: "apr-desc-editor" },
                            R.createElement("textarea", {
                                className: "form-control apr-desc-textarea",
                                rows: 4,
                                placeholder: "Tooltip shown in the scene rating modal.",
                                value: c.description || "",
                                onChange: function (e) { updateCriterion(idx, { description: e.target.value }); },
                            }),
                            R.createElement("div", { className: "apr-desc-editor-actions" },
                                DESCRIPTIONS[c.id] ? R.createElement("button", {
                                    type: "button",
                                    className: "btn btn-link btn-sm",
                                    title: "Reset to the bundled default for this criterion",
                                    onClick: function () { updateCriterion(idx, { description: DESCRIPTIONS[c.id] }); },
                                }, "Reset to default") : null,
                                R.createElement("button", {
                                    type: "button",
                                    className: "btn btn-secondary btn-sm",
                                    onClick: function () { setEditingDescId(null); },
                                }, "Close")))
                        : (previewDesc ? R.createElement("div", { className: "apr-criterion-desc sub-heading" }, previewDesc) : null),
                );
            });

            const msgClass = savingState.kind === "error" ? "apr-msg apr-msg-error"
                : savingState.kind === "success" ? "apr-msg apr-msg-success"
                : "apr-msg";

            return R.createElement("div", { className: "plugin-settings apr-settings" },
                generalSection,
                R.createElement("div", { className: "setting" },
                    R.createElement("div", null,
                        R.createElement("h3", null, "Groups"),
                        R.createElement("div", { className: "sub-heading" },
                            "Criteria are bucketed into groups; each group has its own weight. The final score is the weighted mean of each group's weighted-criterion average. With one group (the default) it's a flat weighted average; with several, group weights balance them."))),
                groupRows,
                R.createElement("div", { className: "setting apr-add-row" },
                    R.createElement("button", { type: "button", className: "btn btn-primary", onClick: addGroup }, "+ Add group")),
                R.createElement("div", { className: "setting" },
                    R.createElement("div", null,
                        R.createElement("h3", null, "Criteria"),
                        R.createElement("div", { className: "sub-heading" },
                            "Tags are stored on disk as \"", R.createElement("code", null, "Name: 0–5"),
                            "\". Rename or reorder freely; weights drive the weighted average within each group, then groups combine using their own weights. Disabled criteria are ignored. ",
                            R.createElement("strong", null, "Save"),
                            " persists changes and automatically creates any missing tags and renames tags for renamed criteria."))),
                rows,
                R.createElement("div", { className: "setting apr-add-row" },
                    R.createElement("button", { type: "button", className: "btn btn-primary", onClick: addCriterion }, "+ Add criterion")),
                R.createElement("div", { className: "setting apr-actions" },
                    R.createElement("button", {
                        type: "button",
                        className: "btn btn-primary",
                        disabled: savingState.saving,
                        title: "Persist config; create missing tags; rename tags for renamed criteria",
                        onClick: save,
                    }, "Save"),
                    R.createElement("button", {
                        type: "button",
                        className: "btn btn-secondary",
                        disabled: savingState.saving,
                        title: "Walk every scene and update its rating from existing tags",
                        onClick: recalcAll,
                    }, "Recalculate all scenes"),
                    R.createElement("button", {
                        type: "button",
                        className: "btn btn-secondary",
                        disabled: savingState.saving,
                        onClick: resetDefaults,
                    }, "Reset to defaults"),
                    R.createElement("button", {
                        type: "button",
                        className: "btn btn-warning",
                        disabled: savingState.saving,
                        title: "Find and delete rating tags whose criterion was renamed or removed from this config",
                        onClick: removeOrphans,
                    }, "Remove orphaned tags"),
                    R.createElement("button", {
                        type: "button",
                        className: "btn btn-danger apr-danger-btn",
                        disabled: savingState.saving,
                        title: "Destroy parent + all criterion + level tags. Requires Allow Destructive Actions.",
                        onClick: deleteAllTags,
                    }, "Delete all rating tags"),
                    savingState.message ? R.createElement("span", { className: msgClass }, savingState.message) : null,
                ));
        };
    }

    function registerSettingsPatch() {
        if (typeof PluginApi === "undefined" || !PluginApi.patch || !PluginApi.React) {
            setTimeout(registerSettingsPatch, 100);
            return;
        }
        const Panel = buildSettingsPanel();
        PluginApi.patch.instead("PluginSettings", function () {
            const args = Array.prototype.slice.call(arguments);
            const next = args.pop();
            const props = args[0];
            const incomingId = props && (props.pluginID || props.pluginId || props.id);
            if (incomingId !== PLUGIN_ID) {
                return next.apply(null, args);
            }
            return PluginApi.React.createElement(Panel);
        });
    }
    registerSettingsPatch();
})();
