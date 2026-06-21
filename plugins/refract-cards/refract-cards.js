/* Refract Cards — standalone rating-tier card frames + playing-card
   performer overlays, extracted from the Refract theme so they can run on
   top of the DEFAULT Stash theme.

   Two independent settings (Settings → Plugins → Refract Cards):
     • Scene cards:     Off | Tier frames
     • Performer cards: Off | Tier frames | Playing card

   Scope is JS-driven: a card only gets a `.refract-card-tier-*` class when
   its type's mode calls for it. The body carries `.refract-cards-tiers`
   while any tier styling is active and `.refract-cards-playing` while the
   performer playing-card layout is on; the CSS keys off those. */
(function () {
    "use strict";

    var PLUGIN_ID = "refract-cards";

    /* ── Theme scope class ───────────────────────────────────────────────
       Everything in the CSS is gated under `body.refract-cards`, so add it
       as early as possible (and again at boot, since React can replace the
       body's className on first paint). */
    function addScope() {
        try {
            if (document.documentElement) { document.documentElement.classList.add("refract-cards"); }
            if (document.body) { document.body.classList.add("refract-cards"); }
        } catch (e) { /* ignore */ }
    }
    addScope();

    /* ── Settings (per-browser, localStorage) ───────────────────────────── */
    var SCENE_KEY = "refractCards.sceneMode";
    var PERF_KEY  = "refractCards.performerMode";
    var SCENE_MODES = ["off", "tiers"];
    var PERF_MODES  = ["off", "tiers", "playing"];
    var DEFAULT_SCENE = "tiers";
    var DEFAULT_PERF  = "playing";

    function getSceneMode() {
        try { var v = localStorage.getItem(SCENE_KEY); if (SCENE_MODES.indexOf(v) !== -1) { return v; } } catch (e) { /* ignore */ }
        return DEFAULT_SCENE;
    }
    function getPerfMode() {
        try { var v = localStorage.getItem(PERF_KEY); if (PERF_MODES.indexOf(v) !== -1) { return v; } } catch (e) { /* ignore */ }
        return DEFAULT_PERF;
    }
    function setSceneMode(v) { try { localStorage.setItem(SCENE_KEY, v); } catch (e) { /* ignore */ } }
    function setPerfMode(v)  { try { localStorage.setItem(PERF_KEY, v);  } catch (e) { /* ignore */ } }

    /* Body mode classes the CSS keys off. `tiers` covers any state where a
       card gets a tier frame (scene tiers, performer tiers, OR playing —
       playing-card cards also wear their tier frame). `playing` adds the
       performer trading-card layout. */
    function applyModeClasses() {
        if (!document.body) { return; }
        var s = getSceneMode(), p = getPerfMode();
        var tiersActive   = (s === "tiers") || (p === "tiers") || (p === "playing");
        var playingActive = (p === "playing");
        document.body.classList.toggle("refract-cards-tiers", tiersActive);
        document.body.classList.toggle("refract-cards-playing", playingActive);
    }
    applyModeClasses();

    /* ── Small helpers ──────────────────────────────────────────────────── */
    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function stopProp(e) { e.stopPropagation(); }

    /* ── Inline SVG glyphs for the playing-card stat strip ──────────────── */
    var PLAY_SVG =
        '<svg viewBox="0 0 512 512" width="10" height="10" fill="currentColor" aria-hidden="true">' +
        '<path d="M188.3 147.1c-7.6 4.2-12.3 12.3-12.3 20.9l0 176c0 8.7 4.7 16.7 12.3 20.9' +
        's16.8 4.1 24.3-.5l144-88c7.1-4.4 11.5-12.1 11.5-20.5s-4.4-16.1-11.5-20.5l-144-88' +
        'c-7.4-4.5-16.7-4.7-24.3-.5z"/></svg>';
    var STAR_SVG =
        '<svg viewBox="0 0 576 512" width="10" height="10" fill="currentColor" aria-hidden="true">' +
        '<path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5' +
        'c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2' +
        ' 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3' +
        's14.9-19.3 12.9-31.3L438.6 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7' +
        's-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/></svg>';
    var CAKE_SVG =
        '<svg viewBox="0 0 448 512" width="10" height="10" fill="currentColor" aria-hidden="true">' +
        '<path d="M86.4 5.5L61.8 47.6c-3.9 6.7-5.8 14.4-5.8 22.2C56 94.2 75.6 112 99.2 112' +
        ' s43.2-17.8 43.2-42.2c0-7.8-1.9-15.5-5.8-22.2L112 5.5C110.3 2 106.9 0 103.2 0H97.2' +
        ' c-3.7 0-7.1 2-8.8 5.5zm96 0L157.8 47.6c-3.9 6.7-5.8 14.4-5.8 22.2c0 24.4 19.6 42.2' +
        ' 43.2 42.2s43.2-17.8 43.2-42.2c0-7.8-1.9-15.5-5.8-22.2L208 5.5C206.3 2 202.9 0 199.2 0' +
        ' h-5.9c-3.7 0-7.1 2-8.8 5.5zm96 0L253.8 47.6c-3.9 6.7-5.8 14.4-5.8 22.2C248 94.2' +
        ' 267.6 112 291.2 112s43.2-17.8 43.2-42.2c0-7.8-1.9-15.5-5.8-22.2L304 5.5C302.3 2' +
        ' 298.9 0 295.2 0h-5.9c-3.7 0-7.1 2-8.8 5.5zM32 192c-17.7 0-32 14.3-32 32V416H384V224' +
        ' c0-17.7-14.3-32-32-32H32zm0 256c-17.7 0-32 14.3-32 32s14.3 32 32 32H352c17.7 0 32-14.3' +
        ' 32-32s-14.3-32-32-32H32z"/></svg>';
    var O_ICON_SVG =
        '<svg viewBox="0 0 36 36" fill="currentColor" aria-hidden="true">' +
        '<path d="M22.855.758L7.875 7.024l12.537 9.733c2.633 2.224 6.377 2.937 9.77 1.518c4.826-2.018 7.096-7.576 5.072-12.413C33.232 1.024 27.68-1.261 22.855.758zm-9.962 17.924L2.05 10.284L.137 23.529a7.993 7.993 0 0 0 2.958 7.803a8.001 8.001 0 0 0 9.798-12.65zm15.339 7.015l-8.156-4.69l-.033 9.223c-.088 2 .904 3.98 2.75 5.041a5.462 5.462 0 0 0 7.479-2.051c1.499-2.644.589-6.013-2.04-7.523z"/>' +
        '</svg>';

    /* ── Rating system (stars vs decimal) ───────────────────────────────
       Only affects the playing-card rating CHIP (show /5 in stars mode,
       /10 in decimal) and the rare text-fallback parse. One lightweight
       GraphQL read at boot; failures are non-fatal (defaults to decimal).
       XHR rather than fetch so we don't trip over plugins that monkey-
       patch window.fetch. Authenticated by the page's own session. */
    function fetchRatingSystem() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "/graphql", true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) { return; }
                try {
                    var res = JSON.parse(xhr.responseText);
                    var ui = res && res.data && res.data.configuration && res.data.configuration.ui;
                    var type = ui && ui.ratingSystemOptions && ui.ratingSystemOptions.type;
                    var isStars = type && String(type).toUpperCase() !== "DECIMAL";
                    if (document.body) {
                        document.body.classList.toggle("refract-cards-rating-stars", !!isStars);
                    }
                } catch (e) { /* ignore */ }
            };
            xhr.send(JSON.stringify({ query: "query { configuration { ui } }" }));
        } catch (e) { /* ignore */ }
    }

    /* ── Rating extraction + tier classification ────────────────────────── */
    var TIERS = ["bronze", "silver", "gold", "diamond", "legendary", "perfect"];

    /* Read a 0–10 rating from a Stash `.rating-banner`. Handles the modern
       `rating-100-N` class (N is rating100; older builds used N = floor/5,
       range 0–20), the legacy `rating-N` star class, and a textContent
       fallback. Mirrors the Refract theme's parse path. */
    function ratingFromBanner(el) {
        if (!el) { return 0; }
        var rating100 = null;
        var m = (el.className || "").match(/\brating-100-(\d+)\b/);
        if (m) {
            var n = parseInt(m[1], 10);
            rating100 = n > 20 ? Math.min(100, n) : n * 5;
        } else {
            m = (el.className || "").match(/\brating-(\d+)\b/);
            if (m) { rating100 = Math.min(100, parseInt(m[1], 10) * 20); }
        }
        if (rating100 === null) {
            var raw = (el.textContent || "").trim();
            var rawV = parseFloat(raw);
            if (isFinite(rawV) && rawV > 0) {
                if (rawV > 5) {
                    rating100 = Math.min(100, rawV * 10);
                } else {
                    var stars = document.body && document.body.classList.contains("refract-cards-rating-stars");
                    rating100 = Math.min(100, stars ? rawV * 20 : rawV * 10);
                }
            }
        }
        return rating100 == null ? 0 : rating100 / 10;
    }

    function tierFor(v) {
        if (v >= 10)  { return "perfect"; }
        if (v >= 9.5) { return "legendary"; }
        if (v >= 8.5) { return "diamond"; }
        if (v >= 7.5) { return "gold"; }
        if (v >= 6.5) { return "silver"; }
        if (v >= 5)   { return "bronze"; }
        return null;
    }

    function currentTier(card) {
        for (var i = 0; i < TIERS.length; i++) {
            if (card.classList.contains("refract-card-tier-" + TIERS[i])) { return TIERS[i]; }
        }
        return null;
    }

    /* Idempotent: only touches classes when the tier actually changes, so
       the MutationObserver doesn't see attribute churn and loop forever. */
    function applyTier(card, v) {
        var target = tierFor(v);
        var cur = currentTier(card);
        if (cur === target) { return; }
        if (cur)    { card.classList.remove("refract-card-tier-" + cur); }
        if (target) { card.classList.add("refract-card-tier-" + target); }
    }
    function clearTier(card) {
        var cur = currentTier(card);
        if (cur) { card.classList.remove("refract-card-tier-" + cur); }
    }

    /* ── Scene cards: tier frames only ──────────────────────────────────── */
    function tagSceneCards() {
        var on = getSceneMode() === "tiers";
        var cards = document.querySelectorAll(".scene-card");
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (!on) { clearTier(card); continue; }
            applyTier(card, ratingFromBanner(card.querySelector(".rating-banner")));
        }
    }

    /* ── Performer cards: tier frames + optional playing-card layout ─────── */
    function initPerformerCards() {
        var mode = getPerfMode();
        var cards = document.querySelectorAll(".performer-card");
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (mode === "off") { clearTier(card); continue; }
            applyTier(card, ratingFromBanner(card.querySelector(".rating-banner")));
            if (mode === "playing" && !card.getAttribute("data-rc-pc")) {
                card.setAttribute("data-rc-pc", "1");
                try { injectPlayingCard(card); } catch (e) { /* ignore one bad card */ }
            }
        }
    }

    /* Build the trading-card overlay for one performer card. Reads data
       straight from the native card DOM (no GraphQL). Native elements are
       hidden by CSS gated on `.refract-cards-playing` — NOT inline here —
       so turning playing-card mode off restores the default card. */
    function injectPlayingCard(card) {
        var section   = card.querySelector(".card-section");
        var ageEl     = card.querySelector(".performer-card__age");
        var sceneLink = card.querySelector(".card-popovers .scene-count");
        var popovers  = card.querySelector(".card-popovers");
        var titleEl   = card.querySelector(".card-section-title");
        var flagEl    = card.querySelector(".performer-card__country-flag, .flag-icon");
        var ratingEl  = card.querySelector(".rating-banner");
        if (!section) { return; }

        var row = document.createElement("div");
        row.className = "stash-perf-stats";

        /* Rating chip */
        if (ratingEl) {
            var ratingNum = ratingFromBanner(ratingEl);
            if (ratingNum && ratingNum > 0) {
                var displayRating = ratingNum;
                var starsMode = document.body.classList.contains("refract-cards-rating-stars");
                if (starsMode) { displayRating = Math.round((ratingNum / 2) * 100) / 100; }
                var rEl = document.createElement("span");
                rEl.className = "stash-perf-rating";
                rEl.title = "Rating " + displayRating + (starsMode ? " / 5" : " / 10");
                rEl.innerHTML = STAR_SVG +
                    '<span class="stash-perf-label">Rating</span>' +
                    "<span>" + escapeHtml(String(displayRating)) + "</span>";
                row.appendChild(rEl);
            }
        }

        /* Age chip (handles Stash's " at production" qualifier) */
        if (ageEl) {
            var ageText = ageEl.textContent.replace(/\s*years?\s+old/gi, "").trim();
            var ageAtProduction = /\s*at\s+production\s*$/i.test(ageText);
            if (ageAtProduction) { ageText = ageText.replace(/\s*at\s+production\s*$/i, "").trim(); }
            if (ageText) {
                var ageSpan = document.createElement("span");
                ageSpan.className = "stash-perf-age";
                if (ageAtProduction) { ageSpan.title = "Age at production"; }
                ageSpan.innerHTML = CAKE_SVG +
                    '<span class="stash-perf-label">Age' +
                        (ageAtProduction ? '<span class="stash-perf-label-mark">*</span>' : '') +
                    '</span>' +
                    "<span>" + escapeHtml(ageText) + "</span>";
                row.appendChild(ageSpan);
            }
        }

        /* O-count chip — Stash renders it as a count-button group inside
           the popovers; only show it when non-zero. */
        var oTitleBtn = popovers ? popovers.querySelector('button[title="O Count"]') : null;
        if (oTitleBtn) {
            var oGroup = oTitleBtn.closest(".count-button");
            var oValueSpan = oGroup ? oGroup.querySelector(".count-value span") : null;
            var oText = oValueSpan ? oValueSpan.textContent.trim() : "";
            if (oText && oText !== "0") {
                var oEl = document.createElement("span");
                oEl.className = "stash-perf-ocount";
                oEl.title = oText + " O";
                oEl.innerHTML = O_ICON_SVG +
                    '<span class="stash-perf-label">O Count</span>' +
                    "<span>" + escapeHtml(oText) + "</span>";
                row.appendChild(oEl);
            }
        }

        /* Scenes chip (links through to the performer's scenes) */
        if (sceneLink) {
            var countEl = sceneLink.querySelector("span");
            var countText = countEl ? countEl.textContent.trim() : "";
            var scenesA = document.createElement("a");
            scenesA.className = "stash-perf-scenes";
            scenesA.href = sceneLink.getAttribute("href") || "#";
            scenesA.addEventListener("click", stopProp);
            scenesA.innerHTML = PLAY_SVG +
                '<span class="stash-perf-label">Scenes</span>' +
                "<span>" + escapeHtml(countText) + "</span>";
            row.appendChild(scenesA);
        }

        /* Tier ribbon placeholder — CSS fills its text from the card's
           `.refract-card-tier-*` class via ::after. */
        var tierLabel = document.createElement("div");
        tierLabel.className = "refract-pc-tier-label";
        card.appendChild(tierLabel);

        section.appendChild(row);

        /* Shrink-to-fit for the stat strip + name banner; re-runs on card
           resize (window zoom, grid reflow). `bannerInner` is var-hoisted
           and assigned below; refit no-ops if it isn't set yet. */
        var bannerInner;
        var refitPending = false;
        function refit() {
            if (refitPending) { return; }
            refitPending = true;
            requestAnimationFrame(function () {
                refitPending = false;
                if (!document.body.classList.contains("refract-cards-playing")) { return; }
                var scales = [1, 0.92, 0.84, 0.76, 0.68, 0.6];
                for (var i = 0; i < scales.length; i++) {
                    row.style.setProperty("--pc-badge-scale", scales[i]);
                    if (row.scrollWidth <= row.clientWidth + 1) { break; }
                }
                if (bannerInner) {
                    var sizes = [1.25, 1.1, 0.95, 0.85, 0.75, 0.7];
                    for (var j = 0; j < sizes.length; j++) {
                        bannerInner.style.fontSize = sizes[j] + "rem";
                        if (bannerInner.scrollWidth <= bannerInner.clientWidth + 1) { break; }
                    }
                }
            });
        }

        /* Country caption — ISO-2 from the flag-icons class -> full name. */
        if (flagEl) {
            var codeMatch = (flagEl.className || "").match(/\bfi-([a-z]{2})\b/i);
            if (codeMatch) {
                var code = codeMatch[1].toUpperCase();
                var countryName = code;
                try {
                    var names = new Intl.DisplayNames(["en"], { type: "region" });
                    countryName = names.of(code) || code;
                } catch (e) { /* fall back to the raw code */ }
                var countryWrap = document.createElement("span");
                countryWrap.className = "stash-perf-country";
                var countryNameSpan = document.createElement("span");
                countryNameSpan.className = "stash-perf-country-name";
                countryNameSpan.textContent = countryName;
                countryWrap.appendChild(countryNameSpan);
                section.insertBefore(countryWrap, row);
            }
        }

        /* Name banner across the top — gender glyph + performer name. */
        if (titleEl) {
            var banner = document.createElement("div");
            banner.className = "refract-pc-name-banner";
            var genderEl = titleEl.querySelector(".gender-icon");
            if (genderEl) { banner.appendChild(genderEl.cloneNode(true)); }
            var nameText;
            var nameSrc = titleEl.querySelector(".TruncatedText") || titleEl;
            if (nameSrc) {
                var nameClone = nameSrc.cloneNode(true);
                nameClone.querySelectorAll(".performer-disambiguation, .disambiguation, .performer-card__country-string").forEach(function (el) {
                    el.remove();
                });
                nameText = (nameClone.textContent || "").trim();
            } else {
                nameText = "";
            }
            bannerInner = document.createElement("span");
            bannerInner.className = "refract-pc-name-text";
            bannerInner.textContent = nameText;
            banner.appendChild(bannerInner);
            card.insertBefore(banner, card.firstChild);
        }

        refit();
        if (window.ResizeObserver) {
            var ro = new ResizeObserver(refit);
            ro.observe(card);
        }
    }

    /* Floating hearts on favourited performers (playing-card mode only).
       Source of truth is Stash's native `.favorite-button.favorite` class,
       which it toggles reactively — so we re-sync every run. The particle
       layer is pointer-events:none; the heart icon itself reveals on hover
       (CSS) so the card stays unfavourite-able. */
    function syncPerformerCardHearts() {
        var inPlaying = getPerfMode() === "playing";
        var cards = document.querySelectorAll(".performer-card");
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var isFav = !!card.querySelector(".favorite-button.favorite");
            var existing = card.querySelector(":scope > .refract-heart-particles");
            if (inPlaying && isFav) {
                card.classList.add("refract-favourite");
                if (!existing) {
                    var particles = document.createElement("div");
                    particles.className = "refract-heart-particles";
                    particles.setAttribute("aria-hidden", "true");
                    for (var hi = 1; hi <= 5; hi++) {
                        var heart = document.createElement("span");
                        heart.className = "refract-heart refract-heart-" + hi;
                        heart.textContent = "♥";
                        particles.appendChild(heart);
                    }
                    card.appendChild(particles);
                }
            } else {
                card.classList.remove("refract-favourite");
                if (existing) { existing.remove(); }
            }
        }
    }

    /* ── Run loop + DOM watcher ─────────────────────────────────────────── */
    var observer = null;
    var scheduled = false;

    function runAll() {
        addScope();
        if (observer) { observer.disconnect(); }
        try { tagSceneCards(); } catch (e) { /* ignore */ }
        try { initPerformerCards(); } catch (e) { /* ignore */ }
        try { syncPerformerCardHearts(); } catch (e) { /* ignore */ }
        if (observer && document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    function scheduleRun() {
        if (scheduled) { return; }
        scheduled = true;
        var run = function () { scheduled = false; runAll(); };
        if (window.requestAnimationFrame) { requestAnimationFrame(run); }
        else { setTimeout(run, 16); }
    }

    function startObserver() {
        if (!window.MutationObserver || !document.body) { return; }
        observer = new MutationObserver(scheduleRun);
        runAll();
    }

    /* Called by the settings panel when a mode changes: re-apply body
       classes, drop the playing-card injection markers if needed, and
       re-run so the change shows immediately without a reload. */
    function onSettingsChanged() {
        applyModeClasses();
        runAll();
    }

    /* ── Settings panel (replaces the native plugin settings row) ──────────
       Stash renders a `PluginSettings` component per plugin that declares
       `settings:` in its manifest. We patch it to render our own React UI
       only for this plugin, leaving every other plugin untouched. */
    function buildSettingsComponent(R) {
        return function RefractCardsSettings() {
            var sceneState = R.useState(getSceneMode());
            var sceneMode = sceneState[0], setSceneState = sceneState[1];
            var perfState = R.useState(getPerfMode());
            var perfMode = perfState[0], setPerfState = perfState[1];

            function pickScene(v) { setSceneMode(v); setSceneState(v); onSettingsChanged(); }
            function pickPerf(v)  { setPerfMode(v);  setPerfState(v);  onSettingsChanged(); }

            function segmented(items, active, onPick) {
                return R.createElement("div", { className: "refract-cards-segmented" },
                    items.map(function (item) {
                        return R.createElement("button", {
                            key: item.key,
                            type: "button",
                            className: "refract-cards-seg-btn" + (active === item.key ? " is-active" : ""),
                            onClick: function () { onPick(item.key); }
                        }, item.label);
                    })
                );
            }

            return R.createElement("div", { className: "plugin-settings refract-cards-settings" },
                R.createElement("div", { className: "setting", id: "refract-cards-scene-mode" },
                    R.createElement("div", null,
                        R.createElement("h3", null, "Scene cards"),
                        R.createElement("div", { className: "sub-heading" },
                            R.createElement("b", null, "Tier frames"),
                            " — rated scene cards (5.0+) get an animated frame + glow that escalates Bronze → Silver → Gold → Diamond → Legendary → Perfect. ",
                            R.createElement("b", null, "Off"),
                            " leaves scene cards exactly as the default theme draws them.")
                    ),
                    segmented(
                        [{ key: "off", label: "Off" }, { key: "tiers", label: "Tier frames" }],
                        sceneMode, pickScene)
                ),
                R.createElement("div", { className: "setting", id: "refract-cards-perf-mode" },
                    R.createElement("div", null,
                        R.createElement("h3", null, "Performer cards"),
                        R.createElement("div", { className: "sub-heading" },
                            R.createElement("b", null, "Tier frames"),
                            " — same Bronze → Perfect frame as scenes. ",
                            R.createElement("b", null, "Playing card"),
                            " — a trading-card layout: name banner across the top with tier glow, a diagonal tier ribbon, and a stat strip along the bottom (rating, age, scenes, O count, country). ",
                            R.createElement("b", null, "Off"),
                            " leaves performer cards untouched.")
                    ),
                    segmented(
                        [{ key: "off", label: "Off" }, { key: "tiers", label: "Tier frames" }, { key: "playing", label: "Playing card" }],
                        perfMode, pickPerf)
                ),
                R.createElement("div", { className: "setting" },
                    R.createElement("div", { className: "sub-heading" },
                        "Settings are saved per browser and apply instantly. Ratings are read from each card's rating badge; if a card shows no rating it gets no tier.")
                )
            );
        };
    }

    function registerSettingsPatch() {
        if (typeof PluginApi === "undefined" || !PluginApi.patch || !PluginApi.React) {
            setTimeout(registerSettingsPatch, 100);
            return;
        }
        var Settings = buildSettingsComponent(PluginApi.React);
        PluginApi.patch.instead("PluginSettings", function () {
            var args = Array.prototype.slice.call(arguments);
            var next = args.pop();
            var props = args[0];
            if (!props || props.pluginID !== PLUGIN_ID) {
                return next.apply(null, args);
            }
            return PluginApi.React.createElement(Settings);
        });
    }
    registerSettingsPatch();

    /* ── Boot ───────────────────────────────────────────────────────────── */
    function boot() {
        addScope();
        applyModeClasses();
        fetchRatingSystem();
        startObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
