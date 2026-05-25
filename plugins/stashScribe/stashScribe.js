/* Stash Scribe — LLM-driven review assistant for scenes and performers.

   What it does:
   - Injects a pen-icon trigger button next to the Advanced Rating
     plugin's button on `/scenes/<id>` and `/performers/<id>` toolbars.
   - Click opens a modal that interviews the user (local LLM via Ollama)
     in one of three voice modes (Direct / Sensual / Filthy), with
     follow-up questions driven by what the user says. Optional
     "kink-mode" overlays (e.g. Trans, Scat) auto-activate when the
     subject's tags match — keeping that language out of unrelated
     reviews.
   - User clicks Generate when ready. LLM produces a long-form review
     + integer scores per Advanced Rating criterion.
   - Review saved to `custom_fields.stashScribe_review`. Scores written
     as `<Criterion> ★: <0-5>` tags — the Advanced Rating plugin's hook
     picks them up and recomputes `rating100` automatically.
   - Renders the saved review back into the scene/performer detail
     panel as a native-looking section (h6 + p.pre on scenes,
     detail-item on performers).
   - Clicking the trigger when a review already exists routes to a
     compact "edit modal" with the textarea + score sliders only,
     plus a "Start fresh interview" escape hatch.

   Architecture:
   - JS UI lives entirely in this file.
   - LLM HTTP calls go through stashScribe.py (Python proxy) because
     the browser CSP blocks direct connections to Ollama. The proxy
     forces UTF-8 on stdin/stdout to work around Windows CP1252 default.
   - All data reads/writes use Stash's GraphQL API. Rating criteria
     are read out of the Advanced Rating plugin's config — both
     domains live under one plugin record, namespaced by key prefix
     (`scene_*` for scene criteria, `performer_*` for performer
     criteria). */

(function () {
    "use strict";

    if (typeof PluginApi === "undefined") return;

    /* ── Constants ───────────────────────────────────────────────────── */

    const PLUGIN_ID = "stashScribe";
    const ADVANCED_RATING_PLUGIN_ID = "advancedRating";

    /* The Advanced Rating plugin encodes per-criterion scores as tag
       names of the form "<Criterion Name> ★: <0-5>". One plugin
       record stores both scene and performer config, namespaced by
       key prefix (`scene_*` / `performer_*`). After stripping the
       domain prefix, the per-criterion keys are `criteria_ids`,
       `name_<id>`, `group_<id>`, `weight_<id>`, `enabled_<id>`,
       `desc_<id>`. */
    const RATING_TAG_SUFFIX = " ★";
    const RATING_CATEGORY_RE = /^(.+?)\s*★\s*:\s*([0-5])$/;

    /* Modal lifecycle: render once per scene visit; cleared on close. */
    let modalEl = null;

    /* Where reviews live on a scene:
       1. Primary  — `scene.custom_fields.stashScribe_review` (survives
          scrapes, since scrapers don't touch custom_fields)
       2. Mirror   — appended at the end of `scene.details` wrapped in
          HTML-comment sentinels. Preserves the existing description
          and stays readable in plain Stash if Scribe is disabled. */
    const REVIEW_FIELD_KEY = "stashScribe_review";
    const REVIEW_MARKER_START = "<!--stash-scribe:review:start-->";
    const REVIEW_MARKER_END = "<!--stash-scribe:review:end-->";

    function extractReviewFromDetails(details) {
        if (!details) return null;
        const startIdx = details.indexOf(REVIEW_MARKER_START);
        if (startIdx === -1) return null;
        const endIdx = details.indexOf(REVIEW_MARKER_END, startIdx);
        if (endIdx === -1) return null;
        return details
            .slice(startIdx + REVIEW_MARKER_START.length, endIdx)
            .trim();
    }

    function stripReviewBlock(details) {
        if (!details) return "";
        const startIdx = details.indexOf(REVIEW_MARKER_START);
        if (startIdx === -1) return details;
        const endIdx = details.indexOf(REVIEW_MARKER_END, startIdx);
        if (endIdx === -1) return details;
        const before = details.slice(0, startIdx).replace(/\s+$/, "");
        const after = details.slice(endIdx + REVIEW_MARKER_END.length).replace(/^\s+/, "");
        if (!before && !after) return "";
        if (!before) return after;
        if (!after) return before;
        return before + "\n\n" + after;
    }

    function appendReviewBlock(details, reviewText) {
        const stripped = stripReviewBlock(details);
        const review = (reviewText || "").trim();
        if (!review) return stripped;
        const block = `${REVIEW_MARKER_START}\n${review}\n${REVIEW_MARKER_END}`;
        return stripped ? `${stripped}\n\n${block}` : block;
    }

    /* Settings — pulled from Stash's plugin config on demand. */
    const DEFAULT_OLLAMA_URL = "http://localhost:11434";
    const DEFAULT_MODEL = "weirdcompound:latest";

    /* Three voice prompts, one per tone. These describe ONLY the
       persona — the workflow (interview phase format, review-phase
       output format) is appended programmatically via the *_CONTRACT
       constants below, so users can't accidentally break parsing by
       editing the voice text. */
    const VOICE_MODES = ["direct", "sensual", "filthy"];
    const VOICE_LABELS = { direct: "Direct", sensual: "Sensual", filthy: "Filthy" };
    const DEFAULT_VOICES = {
        direct: [
            "You are a no-nonsense, highly experienced porn reviewer. Your style is direct, blunt, honest, and sexually explicit. You cut straight to what matters: how fuckable the performer is and how good the scene feels.",
            "",
            "Voice:",
            "- Be clear, straightforward, and vulgar when it fits. No fluff, no fancy metaphors.",
            "- Prioritize visual fuckability (face, tits, ass, body) and raw sexual energy.",
            "- Be honest about flaws (\"great ass, but her face is mid\" or \"she tries hard but sucks at riding\").",
            "- Match the user's vulgarity level — if they're raw, you get raw.",
            "- Confident and perverted, never apologetic or clinical.",
        ].join("\n"),
        sensual: [
            "You are a sophisticated erotic porn reviewer with a seductive, luxurious style. Your writing is rich, sensual, and dripping with desire — elegant filth that builds heat.",
            "",
            "Voice:",
            "- Focus on beauty, body details, skin, movement, and sexual presence.",
            "- Use vivid, tempting, arousing language that makes the reader feel the scene.",
            "- Prioritize how visually intoxicating and fuckable the performer is.",
            "- Stay tastefully explicit while maintaining elegance and flow.",
            "- Seductive, confident, and immersive — make the review feel like slow, delicious foreplay.",
        ].join("\n"),
        filthy: [
            "You are a filthy, degenerate porn reviewer in full Filthy Mode. Be raw, vulgar, nasty, and completely unapologetic. Dive headfirst into the depravity — the wetter, sloppier, dirtier, and more fucked up the scene gets, the better.",
            "",
            "Voice:",
            "- Use crude, explicit, nasty language at all times. Describe cocks, cunts, asses, cumshots, squirting, gaping, choking, piss, vomit, scat, and every other dirty kink with zero shame or hesitation.",
            "- Be brutally honest and degrading when something is weak (\"her face is busted but that asshole takes dick like a champ\" or \"she's a disgusting little scat whore and she loves it\").",
            "- Revel in sluttiness, desperation, filth, and degradation. If she's into piss, vomit, or scat, describe it graphically and enthusiastically.",
            "- Prioritize fuckability, cock-worship, cum-hunger, and how much of a depraved fucktoy the performer is.",
            "- If the user gets vulgar or mentions dirty kinks, go harder and match or exceed their level of filth. No limits, no moralizing, no softening anything.",
            "",
            "Stay in character as a perverted, experienced degenerate who gets off on the nastiest shit in porn.",
        ].join("\n"),
    };

    /* Workflow contracts — appended to whichever voice prompt is
       active. Editing these would break the parser, so they live in
       code and are not exposed in settings.

       Two pairs: scene reviews vs performer reviews. The persona
       (voice) is shared via cfg.voicePrompts; only the workflow
       changes between the two subject types. */
    const INTERVIEW_CONTRACT_SCENE = [
        "You're interviewing the user about this specific scene. Your only job right now is to pull out the dirty details that will justify the final ratings. Do NOT write the actual review yet.",
        "",
        "CRITICAL: Stay strictly in the voice set at the top of the system message. If it's Filthy mode, be crude and nasty. If it's Direct, be blunt. If it's Sensual, stay seductive.",
        "",
        "Use the Scene context above as REFERENCE MATERIAL ONLY. Weave relevant bits in naturally when they matter. Never dump stats, never list tags, never recite the synopsis. Mention the o-counter only if it's actually notable.",
        "",
        "INTERVIEW STRUCTURE — TWO PHASES.",
        "",
        "PHASE 1 (the rating sweep): Work methodically through every rating criterion listed above the contract. ONE question per reply, focused on a SPECIFIC criterion. Ask in any order that feels natural for the conversation, but cover them ALL before moving on. If the user gives a shallow answer, follow up ONCE for filthy specifics, then move to the next unfinished criterion. Track internally which criteria you've already covered — don't ask twice about the same axis.",
        "",
        "PHASE 2 (open follow-ups): Once every rating criterion has a stated impression, switch into open follow-ups about anything that came up — standout moments, chemistry, weaknesses, kinks, money shots, whatever the user seems engaged with. Stay focused on this scene — don't drift into unrelated tangents. Still one question per reply.",
        "",
        "INTERVIEW STYLE — Always pick up on something the user just said when you can. The user controls when to generate — they'll click the Generate button when ready. DO NOT say you have enough information or that you're ready to generate. End every reply with a question.",
        "",
        "FILTHY & USEFUL FOLLOW-UP EXAMPLES (use this style):",
        "- User says \"her ass looked insane\" → \"Tell me about that ass — how it jiggled when she got fucked, how it looked oiled up, did it clap?\"",
        "- User says \"great chemistry\" → \"What made the chemistry so good? Was she actually moaning like she wanted his cock, or was it just decent acting?\"",
        "- User says \"perfect cumshot\" → \"Where did he cum? On her face, tits, inside her? How much, and what was her reaction?\"",
        "",
        "Keep digging until the user clicks Generate. Stay in voice at all times.",
    ].join("\n");
    const REVIEW_CONTRACT_SCENE = [
        "Now write the final review based on everything the user told you.",
        "",
        "- Match the user's voice, tone, and level of explicitness exactly. Mirror their own words and phrasing for what they liked or hated.",
        "- Name the performers. Pull in the specific moments, visual details, body parts, and things the user highlighted — generic or vague reviews are worthless.",
        "- Be honest about weaknesses exactly as the user described them.",
        "- Write 2–4 paragraphs of horny, vivid, sexually charged review prose that actually turns the reader on.",
        "",
        "Then give honest scores (0–5) for each of the rating criteria listed below. Base the scores strictly on what the user actually said.",
        "",
        "Output STRICTLY in this format and NOTHING else (no preamble, no closing chat):",
        "",
        "REVIEW:",
        "<2–4 paragraphs of review prose>",
        "",
        "SCORES:",
        "- <Criterion 1 name>: <0-5 integer>",
        "- <Criterion 2 name>: <0-5 integer>",
        "...",
    ].join("\n");

    const INTERVIEW_CONTRACT_PERFORMER = [
        "You're interviewing the user about this performer. Your only job right now is to dig out the filthy, specific details that will make the final review and ratings actually useful. Do not write the review prose yet.",
        "",
        "CRITICAL: Stay strictly in the voice set at the top of this system message. If it's Filthy mode, be crude, nasty, and vulgar. If it's Direct, be blunt. If it's Sensual, stay seductive and luxurious.",
        "",
        "The Stash data above is REFERENCE MATERIAL ONLY. Treat it like private notes you've already read. Weave in relevant details naturally when they actually matter (a goth look the user just praised, a high o-count that shows real addiction, a specific tattoo on her ass, etc.). Never recite stats, never list tags, never open with a data dump. Mention numbers only when they add something meaningful to the conversation.",
        "",
        "INTERVIEW STRUCTURE — TWO PHASES.",
        "",
        "PHASE 1 (the rating sweep): Work methodically through every rating criterion listed above the contract. ONE question per reply, focused on a SPECIFIC criterion. Ask in any order that feels natural for the conversation, but cover them ALL before moving on. If the user gives a quick or shallow answer, follow up ONCE for filthy specifics (e.g. \"tits are amazing\" → \"shape, jiggle, nipples — what stood out?\"), then move to the next unfinished criterion. Track internally which criteria you've already covered — don't ask twice about the same axis.",
        "",
        "PHASE 2 (open follow-ups): Once you have a stated impression for every rating criterion, switch into open follow-ups. Dig into the user's overall feelings about her, signature kinks, specific scenes, weaknesses, why she keeps pulling them back, archetypal fit, etc. Stay focused on her — don't drift into unrelated tangents. Still one question per reply.",
        "",
        "INTERVIEW STYLE — Always pick up on something the user just said when you can. The user controls when to generate — they'll click the Generate button when ready. Keep the conversation horny and flowing until they stop. DO NOT say you have enough information or that you're ready to generate.",
        "",
        "FIRST MESSAGE: Jump into the first Phase 1 question in voice. Pick the criterion that feels most natural to open with given the data (often Face or overall fuckability). You can lightly anchor with one detail from the Stash data (a high o-count, a striking archetype) but never list stats.",
        "",
        "FILTHY & USEFUL FOLLOW-UP EXAMPLES:",
        "- User says \"amazing tits\" → \"Break those tits down for me — shape, how they bounce when she's getting fucked, nipples, the way they look when oiled up?\"",
        "- User says \"great ass\" → \"Tell me about that ass — how it jiggles, how it looks when she's bent over, does it clap when you pound it?\"",
        "- User mentions goth/e-girl → \"What exactly does her goth look do for you — the pale skin, the dark hair and makeup, that 'perverted alt slut' energy?\"",
        "- User says \"she tries hard\" → \"What does 'tries hard' look like when she's getting railed — desperate moaning, eager riding even if she's bad at it, good eye contact?\"",
        "- User says \"her face is average / ugly\" → \"So her face is mid or straight-up busted — what is it about that butterface look that still gets you hard? The contrast with her body? The 'she knows she's not perfect but tries anyway' vibe?\"",
        "- User says \"she's really into it\" or \"high energy\" → \"What does her 'really into it' energy actually look like? Is she moaning like a whore, actively throwing her ass back, making eye contact while choking on dick, or something else?\"",
        "- User mentions pussy or genitals → \"Tell me about her cunt — is it pretty, puffy, tight-looking, does it grip, get creamy, squirt, or just look like a perfect fuckhole when it's stretched?\"",
        "- User says \"she's not great at sucking/riding\" → \"Break down where she's weak — does she gag too much, lose rhythm when riding, just lie there during doggy, or is it something else that kills the illusion?\"",
        "- User mentions anal → \"What makes her anal scenes hot for you — the way her asshole stretches, the gape after, her facial expressions, or how eagerly she pushes back?\"",
        "- User says \"she's a good slut\" → \"What makes her feel like a real slut to you — the way she begs, how wet she gets, how desperate she acts for cum, or the overall cock-hungry energy?\"",
        "",
        "Pivot naturally between topics as the conversation flows. End EVERY reply with a question. Stay deep in voice at all times.",
    ].join("\n");
    const REVIEW_CONTRACT_PERFORMER = [
        "Now write the long-form performer review. Treat it as a deep character study of this girl across her entire body of work in the user's library.",
        "",
        "- Stay strictly in the voice set at the top of this conversation. If it's Filthy mode, the review must be filthy, vulgar, and nasty from start to finish. If it's Direct, be blunt. If it's Sensual, stay luxurious and seductive.",
        "- Match the user's voice and level of filth exactly. Mirror their own dirty words and phrasing for what they liked or hated.",
        "- The Stash data above is REFERENCE MATERIAL ONLY. Use specific details only when they actually strengthen the review (a tattoo the user praised, a notable scene title, a high o-count that shows real addiction). Never open with stats or recite data just to recite it. Write a horny review, not a stats sheet.",
        "- Pull in specific moments the user mentioned during the interview — face, tits, ass, body, how she fucks, her energy, her sluttiness.",
        "- Be brutally honest about weaknesses exactly as the user described them.",
        "- Write 3–6 paragraphs of vivid, horny, sexually charged review prose that actually turns the reader on.",
        "",
        "Then score each rating criterion listed below using the user's stated impressions as the main signal. Be honest — don't inflate scores.",
        "",
        "Output STRICTLY in this format and NOTHING else (no preamble, no closing chat):",
        "",
        "REVIEW:",
        "<3–6 paragraphs of review prose>",
        "",
        "SCORES:",
        "- <Criterion 1 name>: <0-5 integer>",
        "- <Criterion 2 name>: <0-5 integer>",
        "...",
    ].join("\n");

    /* ── Context overlays (user-configurable) ────────────────────────
       Conditional extensions to the voice prompt — auto-activate when
       the subject's tags match an overlay's regex trigger. Public
       distribution ships empty; each user defines their own overlays
       via the Scribe settings panel (Context overlays section). The
       config lives in Stash's local config.yml, not in the plugin
       repo, so private overlays stay on the user's machine.

       Settings stores the overlays as a JSON string under
       `contextOverlaysJson`. Format (array of objects):
       [
         { "trigger": "\\b(massage|spa)\\b",
           "text": "MASSAGE MODE — focus on the slow build…" },
         …
       ]

       Each entry's `trigger` is compiled to a case-insensitive regex
       and tested against every tag name on the subject. Matching
       overlays' `text` is appended to the system message after the
       voice reminder. */
    function parseContextOverlays(jsonText) {
        if (!jsonText || typeof jsonText !== "string") return [];
        let raw;
        try {
            raw = JSON.parse(jsonText);
        } catch (e) {
            console.warn("[stashScribe] contextOverlaysJson is not valid JSON:", e.message);
            return [];
        }
        if (!Array.isArray(raw)) {
            console.warn("[stashScribe] contextOverlaysJson must be a JSON array of {trigger, text} objects");
            return [];
        }
        const out = [];
        for (const entry of raw) {
            if (!entry || typeof entry.trigger !== "string" || typeof entry.text !== "string") continue;
            let regex;
            try {
                regex = new RegExp(entry.trigger, "i");
            } catch (e) {
                console.warn("[stashScribe] invalid overlay trigger regex:", entry.trigger, e.message);
                continue;
            }
            out.push({ regex, text: entry.text });
        }
        return out;
    }

    function detectActiveKinkModes(tagNames, overlays) {
        if (!Array.isArray(tagNames) || tagNames.length === 0) return [];
        if (!Array.isArray(overlays) || overlays.length === 0) return [];
        const active = [];
        for (const o of overlays) {
            if (tagNames.some(n => n && o.regex.test(n))) {
                active.push(o.text);
            }
        }
        return active;
    }

    /* ── Session persistence ─────────────────────────────────────────
       Stash Scribe sessions live in localStorage keyed by scene ID so
       a user can close the modal mid-interview, navigate away, come
       back later, and resume the same conversation (including any
       Generate result already in the result pane). Cleared once the
       review is saved successfully — completed reviews don't need to
       linger. 30-day TTL trims abandoned sessions. */
    /* Session keys are namespaced by subject type:
       "stashScribe.session.scene.<id>" / ".performer.<id>" */
    const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
    function loadSession(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.ts && Date.now() - data.ts > SESSION_TTL_MS) {
                localStorage.removeItem(key);
                return null;
            }
            return data;
        } catch (e) { return null; }
    }
    function saveSession(key, state) {
        try {
            localStorage.setItem(key, JSON.stringify({
                ts: Date.now(),
                messages: state.messages,
                generated: state.generated || null,
            }));
        } catch (e) { /* quota errors are fine to drop — session is best-effort */ }
    }
    function clearSession(key) {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }

    /* ── GraphQL ─────────────────────────────────────────────────────── */

    async function gqlClient(query, variables, opts) {
        opts = opts || {};
        const controller = new AbortController();
        const timeoutMs = opts.timeoutMs || 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch("/graphql", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, variables }),
                signal: controller.signal,
            });
            const json = await res.json();
            return json;
        } catch (e) {
            if (e.name === "AbortError") {
                throw new Error(`GraphQL request timed out after ${timeoutMs}ms — likely a slow/stuck server-side hook. Check Stash → Settings → Logs for plugin errors.`);
            }
            throw e;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function getAllPluginConfigs() {
        try {
            const res = await gqlClient("query Configuration { configuration { plugins } }");
            return (res.data && res.data.configuration && res.data.configuration.plugins) || {};
        } catch (e) {
            return {};
        }
    }

    /* Read the Stash-Box endpoints + API keys the user has configured
       (Settings → Metadata Providers → Stash-Boxes). Used to look up a
       performer's StashDB profile when their local Stash record is
       sparse. Returns [] silently on error — StashDB enrichment is
       optional, never blocking. */
    async function getStashBoxes() {
        try {
            const res = await gqlClient(
                `query { configuration { general { stashBoxes { endpoint api_key name } } } }`
            );
            const boxes = res && res.data && res.data.configuration
                && res.data.configuration.general && res.data.configuration.general.stashBoxes;
            return Array.isArray(boxes) ? boxes : [];
        } catch (e) {
            return [];
        }
    }

    /* Fetch a performer's profile from StashDB (or any compatible
       stash-box endpoint) using the user's configured API key. Browser
       CSP allows direct connections to stashdb.org / fansdb.cc /
       pmvstash.org so no proxy needed. Returns null on any failure;
       caller treats it as "no extra data available". */
    async function fetchStashBoxPerformer(endpoint, apiKey, stashId) {
        if (!endpoint || !apiKey || !stashId) return null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ApiKey": apiKey,
                },
                signal: controller.signal,
                body: JSON.stringify({
                    query: `query Scribe($id: ID!) {
                        findPerformer(id: $id) {
                            id name disambiguation aliases gender
                            birth_date death_date ethnicity country
                            eye_color hair_color
                            height
                            measurements { cup_size waist hip band_size }
                            breast_type
                            career_start_year career_end_year
                            tattoos { location description }
                            piercings { location description }
                        }
                    }`,
                    variables: { id: stashId },
                }),
            });
            if (!res.ok) return null;
            const json = await res.json();
            return (json && json.data && json.data.findPerformer) || null;
        } catch (e) {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    /* Match a performer's stash_ids list against the user's configured
       stash-boxes, return the first {endpoint, api_key, stash_id} tuple
       we can use. Performers can have multiple stash_ids (StashDB,
       fansdb, etc.); we just take the first one that maps to a
       configured box. */
    function pickStashBoxForPerformer(stashBoxes, stashIds) {
        if (!Array.isArray(stashBoxes) || !Array.isArray(stashIds)) return null;
        for (const sid of stashIds) {
            const box = stashBoxes.find(b => b && b.endpoint === sid.endpoint && b.api_key);
            if (box) return { endpoint: box.endpoint, apiKey: box.api_key, stashId: sid.stash_id };
        }
        return null;
    }

    /* Merge StashDB profile fields onto a local Stash performer object,
       filling gaps without overwriting anything the user has already
       set locally. Returns the augmented object. */
    function mergeStashBoxFields(local, remote) {
        if (!remote) return local;
        const out = { ...local };
        const setIfEmpty = (key, val) => {
            if (val == null || val === "") return;
            if (out[key] == null || out[key] === "") out[key] = val;
        };
        setIfEmpty("birthdate", remote.birth_date);
        setIfEmpty("death_date", remote.death_date);
        setIfEmpty("ethnicity", remote.ethnicity);
        setIfEmpty("country", remote.country);
        setIfEmpty("eye_color", remote.eye_color);
        setIfEmpty("hair_color", remote.hair_color);
        setIfEmpty("height_cm", remote.height);
        /* Measurements: StashDB structures these as { cup_size, band_size, waist, hip }.
           Local Stash stores a free-text string. Build a string only if
           local is empty. */
        if ((!out.measurements || out.measurements === "") && remote.measurements) {
            const m = remote.measurements;
            const bust = (m.band_size && m.cup_size) ? `${m.band_size}${m.cup_size}` : (m.cup_size || "");
            const parts = [bust, m.waist, m.hip].filter(Boolean);
            if (parts.length) out.measurements = parts.join("-");
        }
        if ((!out.fake_tits || out.fake_tits === "") && remote.breast_type) {
            out.fake_tits = remote.breast_type.toLowerCase() === "natural" ? "No" : "Yes";
        }
        /* Career: local Stash uses a free-text "career_length" field.
           StashDB gives explicit start/end years. */
        if ((!out.career_length || out.career_length === "") &&
            (remote.career_start_year || remote.career_end_year)) {
            const start = remote.career_start_year || "?";
            const end = remote.career_end_year || "present";
            out.career_length = `${start} – ${end}`;
        }
        /* Aliases: merge unique values rather than replacing. */
        const remoteAliases = Array.isArray(remote.aliases) ? remote.aliases.filter(Boolean) : [];
        if (remoteAliases.length) {
            const existing = new Set((out.alias_list || []).map(String));
            const merged = [...(out.alias_list || [])];
            remoteAliases.forEach(a => { if (!existing.has(a)) merged.push(a); });
            out.alias_list = merged;
        }
        /* Tattoos / piercings: collapse the StashDB arrays into the
           local string format, only when local is empty. */
        if ((!out.tattoos || out.tattoos === "") && Array.isArray(remote.tattoos) && remote.tattoos.length) {
            out.tattoos = remote.tattoos
                .map(t => [t.location, t.description].filter(Boolean).join(": "))
                .filter(Boolean)
                .join("; ");
        }
        if ((!out.piercings || out.piercings === "") && Array.isArray(remote.piercings) && remote.piercings.length) {
            out.piercings = remote.piercings
                .map(p => [p.location, p.description].filter(Boolean).join(": "))
                .filter(Boolean)
                .join("; ");
        }
        return out;
    }

    async function getScribeConfig() {
        const plugins = await getAllPluginConfigs();
        const cfg = plugins[PLUGIN_ID] || {};
        /* Tone migration: pre-multi-voice configs allowed "vulgar"
           and "elegant" — map those onto the new 3-mode taxonomy. */
        let tone = (cfg.defaultTone || "filthy").toLowerCase();
        if (tone === "vulgar") tone = "filthy";
        else if (tone === "elegant") tone = "sensual";
        if (VOICE_MODES.indexOf(tone) === -1) tone = "filthy";
        /* Voice prompts. Legacy `interviewSystem` (single-prompt
           config) maps onto the filthy slot since that's the voice it
           was written for. */
        const voicePrompts = {
            direct:  cfg.voicePrompt_direct  || DEFAULT_VOICES.direct,
            sensual: cfg.voicePrompt_sensual || DEFAULT_VOICES.sensual,
            filthy:  cfg.voicePrompt_filthy  || cfg.interviewSystem || DEFAULT_VOICES.filthy,
        };
        return {
            ollamaUrl: (cfg.ollamaUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, ""),
            model: cfg.model || DEFAULT_MODEL,
            voicePrompts,
            defaultTone: tone,
            autoCreateTags: cfg.autoCreateTags !== false,
            contextOverlaysJson: cfg.contextOverlaysJson || "",
            contextOverlays: parseContextOverlays(cfg.contextOverlaysJson),
        };
    }

    async function configurePlugin(input) {
        return gqlClient(
            `mutation ConfigurePlugin($plugin_id: ID!, $input: Map!) {
                configurePlugin(plugin_id: $plugin_id, input: $input)
            }`,
            { plugin_id: PLUGIN_ID, input }
        );
    }

    /* ── Rating-criteria reader (Advanced Rating plugin) ─────────────
       Reads the merged plugin's config to discover the user's per-
       criterion rating axes for one domain (scene or performer). Both
       domains live under one plugin record, namespaced by `scene_*` /
       `performer_*` prefix — we strip the prefix and read the bare
       keys. If the plugin isn't installed / not configured the
       returned array is empty and the modal falls back to review-only. */
    async function loadCriteriaForDomain(domain) {
        const plugins = await getAllPluginConfigs();
        const raw = plugins[ADVANCED_RATING_PLUGIN_ID] || {};
        const prefix = domain + "_";
        const idsRaw = raw[prefix + "criteria_ids"] || "";
        const ids = idsRaw.split(",").map(s => s.trim()).filter(Boolean);
        return ids.map(id => ({
            id,
            name: raw[prefix + "name_" + id] || id,
            group: raw[prefix + "group_" + id] || "",
            weight: parseFloat(raw[prefix + "weight_" + id] || "1") || 1,
            enabled: raw[prefix + "enabled_" + id] !== false,
            description: raw[prefix + "desc_" + id] || "",
        })).filter(c => c.enabled && c.name);
    }
    const loadSceneCriteria = () => loadCriteriaForDomain("scene");
    const loadPerformerCriteria = () => loadCriteriaForDomain("performer");

    /* ── Scene context ───────────────────────────────────────────────── */

    async function fetchSceneContext(sceneId) {
        const res = await gqlClient(
            `query SceneForScribe($id: ID!) {
                findScene(id: $id) {
                    id title date details rating100 custom_fields
                    o_counter play_count
                    studio { name }
                    performers {
                        name gender birthdate ethnicity
                        hair_color eye_color height_cm measurements fake_tits
                        tattoos piercings
                    }
                    tags { id name }
                }
            }`,
            { id: sceneId }
        );
        return (res && res.data && res.data.findScene) || null;
    }

    /* Return the existing review for a scene, if any. Prefers
       custom_fields (scrape-resilient) and falls back to parsing the
       sentinel block out of details. Returns null if neither has a
       previous review. */
    function readExistingReview(scene) {
        if (!scene) return null;
        const cf = scene.custom_fields || {};
        if (cf[REVIEW_FIELD_KEY]) return String(cf[REVIEW_FIELD_KEY]).trim();
        const fromDetails = extractReviewFromDetails(scene.details);
        return fromDetails || null;
    }

    function ageAtDate(birthdate, atDate) {
        if (!birthdate || !atDate) return null;
        const bd = new Date(birthdate);
        const at = new Date(atDate);
        if (isNaN(bd.getTime()) || isNaN(at.getTime())) return null;
        let age = at.getFullYear() - bd.getFullYear();
        const m = at.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && at.getDate() < bd.getDate())) age--;
        return age >= 0 && age < 120 ? age : null;
    }

    function describePerformerInScene(p, sceneDate) {
        if (!p || !p.name) return "";
        const bits = [p.name];
        const tail = [];
        const age = ageAtDate(p.birthdate, sceneDate);
        if (age != null) tail.push(`age ${age} here`);
        if (p.ethnicity) tail.push(p.ethnicity.toLowerCase());
        if (p.hair_color) tail.push(p.hair_color.toLowerCase() + " hair");
        if (p.height_cm) tail.push(`${p.height_cm}cm`);
        if (p.measurements) tail.push(p.measurements);
        if (p.fake_tits) tail.push(p.fake_tits.toLowerCase() === "yes" ? "fake tits" : "natural tits");
        if (p.tattoos) tail.push("tattooed");
        if (p.piercings) tail.push("pierced");
        if (tail.length) bits.push("(" + tail.join(", ") + ")");
        return bits.join(" ");
    }

    function describeSceneForLLM(scene) {
        if (!scene) return "";
        const lines = [];
        if (scene.title) lines.push(`Title: ${scene.title}`);
        if (scene.studio && scene.studio.name) lines.push(`Studio: ${scene.studio.name}`);
        if (scene.date) lines.push(`Date: ${scene.date}`);

        const perfs = (scene.performers || []).slice(0, 10);
        if (perfs.length) {
            const perfLines = perfs.map(p => describePerformerInScene(p, scene.date)).filter(Boolean);
            lines.push(perfs.length > 1 ? "Performers:" : "Performer:");
            perfLines.forEach(l => lines.push("- " + l));
        }

        const userStats = [];
        if (scene.o_counter) userStats.push(`o-counter ${scene.o_counter}`);
        if (scene.play_count) userStats.push(`played ${scene.play_count}×`);
        if (scene.rating100 != null) userStats.push(`already rated ${scene.rating100}/100`);
        if (userStats.length) lines.push(`Your history with this scene: ${userStats.join(", ")}`);

        const tags = (scene.tags || []).map(t => t.name).filter(n => n && !RATING_CATEGORY_RE.test(n));
        if (tags.length) lines.push(`Tags: ${tags.slice(0, 25).join(", ")}`);

        /* Strip any previously-saved Scribe review block before
           passing details to the LLM — otherwise it sees its own
           last take and tends to parrot it instead of asking
           fresh questions. */
        const cleanDetails = stripReviewBlock(scene.details).trim();
        if (cleanDetails) lines.push(`Scene synopsis / existing notes: ${cleanDetails}`);
        return lines.join("\n");
    }

    /* ── Performer context ───────────────────────────────────────────
       Stash performers don't expose o_counter / scene_count directly,
       so we run two queries: the profile, plus an unbounded scenes
       query filtered by performer to aggregate the library-wide stats
       the LLM needs for a character-study review. */
    async function fetchPerformerContext(performerId) {
        const profileRes = await gqlClient(
            `query PerformerForScribe($id: ID!) {
                findPerformer(id: $id) {
                    id name details rating100 custom_fields
                    birthdate death_date country ethnicity hair_color eye_color
                    height_cm weight measurements fake_tits gender favorite
                    career_length tattoos piercings alias_list
                    stash_ids { endpoint stash_id }
                    tags { id name }
                }
            }`,
            { id: performerId }
        );
        const performer = profileRes && profileRes.data && profileRes.data.findPerformer;
        if (!performer) return null;

        /* per_page: -1 = all scenes. We pull title/details/custom_fields
           too so we can hand notable scenes (top-rated, most-fapped,
           most-watched) to the LLM with their existing Scribe review
           text or scraped synopsis attached — that's what makes the
           performer review feel grounded in specifics rather than
           generic. Payload size is fine: hundreds of scenes is still
           ~tens of KB of JSON, and we trim before sending to the LLM. */
        const scenesRes = await gqlClient(
            `query ScenesForPerformer($id: ID!) {
                findScenes(
                    scene_filter: { performers: { value: [$id], modifier: INCLUDES } }
                    filter: { per_page: -1 }
                ) {
                    count
                    scenes {
                        id title rating100 o_counter play_count date
                        details custom_fields
                        studio { name }
                        tags { name }
                    }
                }
            }`,
            { id: performerId }
        );
        const list = (scenesRes && scenesRes.data && scenesRes.data.findScenes) || {};
        const scenes = list.scenes || [];
        const sceneCount = list.count != null ? list.count : scenes.length;

        const totalOCounter = scenes.reduce((sum, s) => sum + (s.o_counter || 0), 0);
        const rated = scenes.filter(s => s.rating100 != null);
        const avgRating = rated.length
            ? Math.round(rated.reduce((a, s) => a + s.rating100, 0) / rated.length)
            : null;

        const tagFreq = {};
        scenes.forEach(s => (s.tags || []).forEach(t => {
            if (t.name && !RATING_CATEGORY_RE.test(t.name)) {
                tagFreq[t.name] = (tagFreq[t.name] || 0) + 1;
            }
        }));
        const topTags = Object.keys(tagFreq)
            .sort((a, b) => tagFreq[b] - tagFreq[a])
            .slice(0, 10);

        const studioFreq = {};
        scenes.forEach(s => {
            if (s.studio && s.studio.name) {
                studioFreq[s.studio.name] = (studioFreq[s.studio.name] || 0) + 1;
            }
        });
        const topStudios = Object.keys(studioFreq)
            .sort((a, b) => studioFreq[b] - studioFreq[a])
            .slice(0, 5);

        /* Notable-scenes picker: union of top-3 by rating, top-3 by
           o_counter, top-3 by play_count. Dedup, cap to 8. This is
           the per-scene material the LLM uses to ground the performer
           review in specifics — its existing reviews / synopses /
           signature tags rather than just aggregate stats. */
        function topN(arr, key, n) {
            return arr
                .filter(s => (s[key] || 0) > 0)
                .sort((a, b) => (b[key] || 0) - (a[key] || 0))
                .slice(0, n);
        }
        const notableIds = new Set();
        const notable = [];
        [...topN(scenes, "rating100", 3),
         ...topN(scenes, "o_counter", 3),
         ...topN(scenes, "play_count", 3)].forEach(s => {
            if (!notableIds.has(s.id)) {
                notableIds.add(s.id);
                notable.push(s);
            }
        });

        return {
            performer,
            aggregates: {
                sceneCount,
                totalOCounter,
                ratedCount: rated.length,
                avgRating,
                topTags,
                topStudios,
                notableScenes: notable.slice(0, 5),
            },
        };
    }

    /* Compact scene description for the performer-review LLM context.
       Prefers the user's own Scribe review (most signal) over scraped
       synopsis. Truncates each block so 8 scenes don't blow context. */
    function summarizeNotableScene(scene) {
        const lines = [];
        const headerBits = [];
        if (scene.title) headerBits.push(`"${scene.title}"`);
        if (scene.studio && scene.studio.name) headerBits.push(scene.studio.name);
        if (scene.date) headerBits.push(scene.date);
        lines.push("• " + headerBits.join(" — "));
        const stats = [];
        if (scene.rating100 != null) stats.push(`rating ${scene.rating100}/100`);
        if (scene.o_counter) stats.push(`${scene.o_counter} O`);
        if (scene.play_count) stats.push(`${scene.play_count} plays`);
        if (stats.length) lines.push("  " + stats.join(", "));
        const tags = (scene.tags || [])
            .map(t => t.name)
            .filter(n => n && !RATING_CATEGORY_RE.test(n))
            .slice(0, 8);
        if (tags.length) lines.push("  tags: " + tags.join(", "));
        const cf = scene.custom_fields || {};
        const scribeReview = cf[REVIEW_FIELD_KEY] && String(cf[REVIEW_FIELD_KEY]).trim();
        const detailsClean = stripReviewBlock(scene.details || "").trim();
        const fromDetailsReview = extractReviewFromDetails(scene.details || "");
        const reviewText = scribeReview || fromDetailsReview;
        if (reviewText) {
            lines.push("  your review: " + truncate(reviewText, 400));
        } else if (detailsClean) {
            lines.push("  synopsis: " + truncate(detailsClean, 300));
        }
        return lines.join("\n");
    }

    function truncate(s, max) {
        if (!s) return "";
        return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
    }

    function ageFromBirthdate(birthdate) {
        if (!birthdate) return null;
        const bd = new Date(birthdate);
        if (isNaN(bd.getTime())) return null;
        const now = new Date();
        let age = now.getFullYear() - bd.getFullYear();
        const m = now.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
        return age >= 0 && age < 120 ? age : null;
    }

    function describePerformerForLLM(performer, aggregates) {
        if (!performer) return "";
        const lines = [];
        lines.push(`Name: ${performer.name}`);
        const aliases = (performer.alias_list || []).filter(a => a && a !== performer.name);
        if (aliases.length) lines.push(`Aliases: ${aliases.join(", ")}`);
        const demo = [];
        if (performer.gender) demo.push(performer.gender.toLowerCase());
        const age = ageFromBirthdate(performer.birthdate);
        if (age != null) demo.push(performer.death_date ? `was age ${age}` : `age ${age}`);
        if (performer.ethnicity) demo.push(performer.ethnicity);
        if (performer.country) demo.push(performer.country);
        if (demo.length) lines.push(`Demographics: ${demo.join(", ")}`);
        const phys = [];
        if (performer.hair_color) phys.push(`hair ${performer.hair_color}`);
        if (performer.eye_color) phys.push(`eyes ${performer.eye_color}`);
        if (performer.height_cm) phys.push(`${performer.height_cm}cm`);
        if (performer.weight) phys.push(`${performer.weight}kg`);
        if (performer.measurements) phys.push(performer.measurements);
        if (performer.fake_tits) phys.push(performer.fake_tits.toLowerCase() === "yes" ? "fake tits" : "natural tits");
        if (phys.length) lines.push(`Physical: ${phys.join(", ")}`);
        if (performer.tattoos) lines.push(`Tattoos: ${performer.tattoos}`);
        if (performer.piercings) lines.push(`Piercings: ${performer.piercings}`);
        if (performer.career_length) lines.push(`Career: ${performer.career_length}`);
        if (aggregates) {
            const a = aggregates;
            const stats = [`${a.sceneCount} scenes in library`];
            if (a.totalOCounter > 0) {
                /* Spell out the o-counter semantics — the LLM otherwise
                   reads "N logged orgasms" as "N scenes had an orgasm",
                   which is wrong (it's a cumulative SUM across scenes,
                   and a single scene's count can be >1). */
                stats.push(`Stash o-counter total ${a.totalOCounter} (sum across her scenes — a single scene can contribute multiple)`);
            }
            if (a.avgRating != null) stats.push(`average rating ${a.avgRating}/100 across ${a.ratedCount} scenes you have rated`);
            lines.push(`Library stats: ${stats.join("; ")}`);
            if (a.topStudios.length) lines.push(`Top studios: ${a.topStudios.join(", ")}`);
            if (a.topTags.length) lines.push(`Signature tags: ${a.topTags.join(", ")}`);
            if (a.notableScenes && a.notableScenes.length) {
                lines.push("");
                lines.push("Notable scenes (top by rating / o-count / play-count — reference these specifically in the review):");
                a.notableScenes.forEach(s => lines.push(summarizeNotableScene(s)));
            }
        }
        const cleanDetails = stripReviewBlock(performer.details).trim();
        if (cleanDetails) lines.push(`Bio / existing notes: ${cleanDetails}`);
        return lines.join("\n");
    }

    /* ── LLM bridge (via Stash's runPluginOperation → Python proxy) ───
       We can't fetch Ollama directly from the browser: Stash's CSP
       hard-allows only `'self'` + the three scraper-DB hosts for
       `connect-src`. Routing through stashScribe.py keeps everything
       same-origin (browser → Stash GraphQL → Python on the same PC →
       localhost:11434), and the Python proxy never has to deal with
       CORS / mixed content. */

    async function runPluginOp(args) {
        const res = await gqlClient(
            `mutation RunScribeOp($plugin_id: ID!, $args: Map!) {
                runPluginOperation(plugin_id: $plugin_id, args: $args)
            }`,
            { plugin_id: PLUGIN_ID, args }
        );
        if (res.errors && res.errors.length) {
            throw new Error(res.errors[0].message);
        }
        const out = res.data && res.data.runPluginOperation;
        if (out && out.error) throw new Error(out.error);
        return out;
    }

    async function callLLM(messages, cfg) {
        const out = await runPluginOp({
            op: "chat",
            ollamaUrl: cfg.ollamaUrl,
            model: cfg.model,
            messages,
            temperature: 0.85,
        });
        if (!out || !out.content) throw new Error("Ollama returned no content");
        return out.content;
    }

    async function listModels(cfg) {
        const out = await runPluginOp({
            op: "list_models",
            ollamaUrl: cfg.ollamaUrl,
        });
        return (out && out.models) || [];
    }

    /* ── Output parsing ──────────────────────────────────────────────── */
    /* Final-phase prompt asks for `REVIEW:\n...\nSCORES:\n- Name: N`. */

    function parseGenerated(body, criteria) {
        const reviewMatch = body.match(/REVIEW:\s*([\s\S]*?)(?=\n\s*SCORES\s*:|$)/i);
        const review = reviewMatch ? reviewMatch[1].trim() : body.trim();
        const scores = {};
        const scoresBlock = body.split(/SCORES\s*:/i)[1] || "";
        const lineRe = /^[\s•\-\*]*(.+?)\s*[:|—-]\s*(\d+(?:\.\d+)?)\s*$/gim;
        let m;
        while ((m = lineRe.exec(scoresBlock)) !== null) {
            const rawName = m[1].trim();
            const rawScore = Math.max(0, Math.min(5, Math.round(parseFloat(m[2]))));
            /* Match against criteria by case-insensitive name. */
            const c = criteria.find(c => c.name.toLowerCase() === rawName.toLowerCase());
            if (c) scores[c.id] = rawScore;
        }
        return { review, scores };
    }

    /* ── Tag helpers (write-back) ────────────────────────────────────── */

    async function getTagIdByName(name) {
        const res = await gqlClient(
            `query FindTags($tag_filter: TagFilterType) {
                findTags(tag_filter: $tag_filter) { tags { id name } }
            }`,
            { tag_filter: { name: { value: name, modifier: "EQUALS" } } }
        );
        const tags = res.data && res.data.findTags && res.data.findTags.tags;
        return tags && tags.length ? tags[0].id : null;
    }

    async function findOrCreateTag(name) {
        let id = await getTagIdByName(name);
        if (id) return id;
        const create = await gqlClient(
            `mutation TagCreate($input: TagCreateInput!) {
                tagCreate(input: $input) { id }
            }`,
            { input: { name, ignore_auto_tag: true } }
        );
        id = create.data && create.data.tagCreate && create.data.tagCreate.id;
        if (!id) throw new Error("Failed to create tag: " + name);
        return id;
    }

    /* Replace any existing `<criterion name> ★: <n>` tags on the
       subject (scene or performer — both expose `.tags` with the
       same shape) with the new ones from `scoresByCriterion`. Returns
       the new tag-id list to pass into sceneUpdate / performerUpdate. */
    async function buildUpdatedTagIds(subjectWithTags, criteria, scoresByCriterion, autoCreate) {
        const existingTags = subjectWithTags.tags || [];
        const keep = existingTags.filter(t => {
            const m = (t.name || "").match(RATING_CATEGORY_RE);
            if (!m) return true; /* not a rating tag — keep */
            const criterionName = m[1].trim();
            /* Drop any old rating tag for a criterion we're updating. */
            return !criteria.some(c => c.name === criterionName);
        });
        const newTagIds = keep.map(t => t.id);
        for (const c of criteria) {
            const score = scoresByCriterion[c.id];
            if (score == null) continue;
            const tagName = `${c.name}${RATING_TAG_SUFFIX}: ${score}`;
            let tagId = await getTagIdByName(tagName);
            if (!tagId) {
                if (!autoCreate) {
                    throw new Error(`Tag "${tagName}" does not exist. Open the Advanced Rating plugin's settings panel once so it creates the level tags, or enable "Auto-create missing criterion tags" in Stash Scribe settings.`);
                }
                tagId = await findOrCreateTag(tagName);
            }
            if (newTagIds.indexOf(tagId) === -1) newTagIds.push(tagId);
        }
        return newTagIds;
    }

    async function sceneUpdate(input) {
        const res = await gqlClient(
            `mutation SceneUpdate($input: SceneUpdateInput!) {
                sceneUpdate(input: $input) { id }
            }`,
            { input }
        );
        if (res.errors && res.errors.length) throw new Error(res.errors[0].message);
        return res;
    }

    async function performerUpdate(input) {
        const res = await gqlClient(
            `mutation PerformerUpdate($input: PerformerUpdateInput!) {
                performerUpdate(input: $input) { id }
            }`,
            { input }
        );
        if (res.errors && res.errors.length) throw new Error(res.errors[0].message);
        return res;
    }

    async function saveSceneReview(scene, reviewText, criteria, scoresByCriterion, autoCreate) {
        const input = { id: scene.id };
        if (typeof reviewText === "string") {
            /* Custom-fields is the sole review home now. The rendered
               review section on the scene page reads from here. We
               also strip any leftover sentinel block from a v1 hybrid
               save so the Details panel no longer shows a duplicate. */
            input.custom_fields = { partial: { [REVIEW_FIELD_KEY]: reviewText } };
            const cleaned = stripReviewBlock(scene.details || "");
            if (cleaned !== (scene.details || "")) input.details = cleaned;
        }
        if (Object.keys(scoresByCriterion).length > 0) {
            input.tag_ids = await buildUpdatedTagIds(scene, criteria, scoresByCriterion, autoCreate);
        }
        await sceneUpdate(input);
    }

    async function savePerformerReview(performer, reviewText, criteria, scoresByCriterion, autoCreate) {
        const baseInput = { id: performer.id };
        if (Object.keys(scoresByCriterion).length > 0) {
            baseInput.tag_ids = await buildUpdatedTagIds(performer, criteria, scoresByCriterion, autoCreate);
        }
        if (typeof reviewText === "string") {
            /* Try custom_fields first (preferred — keeps performer.details
               clean). PerformerUpdateInput.custom_fields support is
               unverified across Stash versions; if it gets rejected we
               fall back to a sentinel block in details with a warning. */
            const cleanedDetails = stripReviewBlock(performer.details || "");
            try {
                const cf = { custom_fields: { partial: { [REVIEW_FIELD_KEY]: reviewText } } };
                const detailsPatch = cleanedDetails !== (performer.details || "")
                    ? { details: cleanedDetails }
                    : {};
                await performerUpdate({ ...baseInput, ...cf, ...detailsPatch });
                return;
            } catch (e) {
                if (!/custom_fields/i.test(e.message || "")) throw e;
                console.warn("[stashScribe] PerformerUpdateInput.custom_fields rejected — falling back to details sentinel block", e);
                baseInput.details = appendReviewBlock(cleanedDetails, reviewText);
            }
        }
        await performerUpdate(baseInput);
    }

    /* ── Subject builders ────────────────────────────────────────────
       A Subject packages everything the modal needs to drive a review
       flow against a particular Stash object (scene or performer):
       title, context, criteria, the right prompt contracts, the right
       save function. openModal() is subject-agnostic — it just wires
       UI to subject.* accessors. */

    function buildSceneContextStrip(scene) {
        const bits = [];
        if (scene.studio && scene.studio.name) bits.push(scene.studio.name);
        const perfs = (scene.performers || []).map(p => p.name).filter(Boolean);
        if (perfs.length) bits.push(perfs.join(" · "));
        const tagCount = (scene.tags || []).filter(t => !RATING_CATEGORY_RE.test(t.name)).length;
        if (tagCount) bits.push(`${tagCount} tags`);
        return bits.join(" — ");
    }

    function buildPerformerContextStrip(performer, agg) {
        const bits = [performer.name];
        if (agg && agg.sceneCount) bits.push(`${agg.sceneCount} scenes`);
        if (agg && agg.totalOCounter) bits.push(`${agg.totalOCounter} 💧`);
        if (agg && agg.topStudios && agg.topStudios.length) {
            bits.push(agg.topStudios.slice(0, 2).join(" · "));
        }
        return bits.join(" — ");
    }

    /* Extract the current per-criterion scores from a subject's tags
       (matches the Advanced Rating plugin's "<Name> ★: <0-5>" format).
       Used to pre-fill sliders in edit mode so the user sees the
       existing values rather than empty sliders that would clear them
       on save. */
    function extractScoresFromTags(subjectWithTags, criteria) {
        const scores = {};
        const tags = subjectWithTags.tags || [];
        for (const t of tags) {
            const m = (t.name || "").match(RATING_CATEGORY_RE);
            if (!m) continue;
            const criterionName = m[1].trim();
            const score = parseInt(m[2], 10);
            const c = criteria.find(cc => cc.name === criterionName);
            if (c) scores[c.id] = score;
        }
        return scores;
    }

    async function buildSceneSubject(sceneId) {
        const [scene, criteria, cfg] = await Promise.all([
            fetchSceneContext(sceneId),
            loadSceneCriteria(),
            getScribeConfig(),
        ]);
        if (!scene) return null;
        const tagNames = (scene.tags || []).map(t => t.name).filter(Boolean);
        return {
            type: "scene",
            id: sceneId,
            sessionKey: "stashScribe.session.scene." + sceneId,
            title: scene.title ? `Stash Scribe — ${scene.title}` : "Stash Scribe",
            contextStrip: buildSceneContextStrip(scene),
            contextForLLM: describeSceneForLLM(scene),
            existingReview: readExistingReview(scene),
            currentScores: extractScoresFromTags(scene, criteria),
            criteria,
            criteriaSourceLabel: "Advanced Rating",
            interviewContract: INTERVIEW_CONTRACT_SCENE,
            reviewContract: REVIEW_CONTRACT_SCENE,
            activeKinkModes: detectActiveKinkModes(tagNames, cfg.contextOverlays),
            save: ({ reviewText, scoresByCriterion, autoCreate }) =>
                saveSceneReview(scene, reviewText, criteria, scoresByCriterion, autoCreate),
        };
    }

    async function buildPerformerSubject(performerId) {
        const [ctx, criteria, cfg, stashBoxes] = await Promise.all([
            fetchPerformerContext(performerId),
            loadPerformerCriteria(),
            getScribeConfig(),
            getStashBoxes(),
        ]);
        if (!ctx) return null;
        let { performer, aggregates } = ctx;
        /* StashDB enrichment — non-blocking. If the performer has a
           stash_id matching one of the user's configured stash-boxes,
           pull the remote profile and fill any gaps in local data. */
        const boxMatch = pickStashBoxForPerformer(stashBoxes, performer.stash_ids);
        if (boxMatch) {
            const remote = await fetchStashBoxPerformer(boxMatch.endpoint, boxMatch.apiKey, boxMatch.stashId);
            if (remote) performer = mergeStashBoxFields(performer, remote);
        }
        /* For performers, kink detection draws from BOTH the performer's
           own tags (categories explicitly applied to her) AND the
           signature tags computed from her library (kinks that show
           up across her scenes). */
        const perfTagNames = (performer.tags || []).map(t => t.name).filter(Boolean);
        const sigTagNames = (aggregates && aggregates.topTags) ? aggregates.topTags : [];
        return {
            type: "performer",
            id: performerId,
            sessionKey: "stashScribe.session.performer." + performerId,
            title: performer.name ? `Stash Scribe — ${performer.name}` : "Stash Scribe",
            contextStrip: buildPerformerContextStrip(performer, aggregates),
            contextForLLM: describePerformerForLLM(performer, aggregates),
            existingReview: readExistingReview(performer),
            currentScores: extractScoresFromTags(performer, criteria),
            criteria,
            criteriaSourceLabel: "Advanced Rating",
            interviewContract: INTERVIEW_CONTRACT_PERFORMER,
            reviewContract: REVIEW_CONTRACT_PERFORMER,
            activeKinkModes: detectActiveKinkModes(perfTagNames.concat(sigTagNames), cfg.contextOverlays),
            save: ({ reviewText, scoresByCriterion, autoCreate }) =>
                savePerformerReview(performer, reviewText, criteria, scoresByCriterion, autoCreate),
        };
    }

    /* ── Modal ───────────────────────────────────────────────────────── */

    function buildModalDOM() {
        const overlay = document.createElement("div");
        overlay.className = "stash-scribe-modal-overlay";
        overlay.innerHTML = `
            <div class="stash-scribe-modal" role="dialog" aria-modal="true" aria-labelledby="stash-scribe-title">
                <div class="stash-scribe-header">
                    <h3 id="stash-scribe-title">Stash Scribe</h3>
                    <div class="stash-scribe-header-actions">
                        <button type="button" class="stash-scribe-restart" data-role="restart"
                                title="Discard this session and start a fresh interview">Start over</button>
                        <button type="button" class="stash-scribe-close" aria-label="Close">×</button>
                    </div>
                </div>
                <div class="stash-scribe-context" data-role="context"></div>
                <div class="stash-scribe-intro" data-role="intro" hidden>
                    <p class="stash-scribe-intro-lead">No review yet. Pick how you want to write it.</p>
                    <div class="stash-scribe-intro-tone">
                        <label class="stash-scribe-label" for="stash-scribe-intro-tone-select">Voice</label>
                        <select class="stash-scribe-intro-tone-select" data-role="intro-tone" id="stash-scribe-intro-tone-select"></select>
                    </div>
                    <div class="stash-scribe-intro-actions">
                        <button type="button" class="stash-scribe-secondary" data-role="intro-manual">Write manually</button>
                        <button type="button" class="stash-scribe-primary" data-role="intro-llm">Start LLM interview</button>
                    </div>
                    <p class="stash-scribe-intro-note">LLM mode runs an interview via Ollama. If Ollama is offline or you don't want to load a model, use <strong>Write manually</strong> — same save target, no LLM call.</p>
                </div>
                <div class="stash-scribe-transcript" data-role="transcript" tabindex="0"></div>
                <div class="stash-scribe-status" data-role="status" aria-live="polite"></div>
                <div class="stash-scribe-input-row" data-phase="interview">
                    <textarea class="stash-scribe-input" data-role="input"
                        placeholder="Type your answer and press Enter (Shift+Enter for newline)…"
                        rows="2"></textarea>
                    <button type="button" class="stash-scribe-send" data-role="send">Send</button>
                </div>
                <div class="stash-scribe-actions">
                    <button type="button" class="stash-scribe-primary" data-role="generate" disabled>
                        Generate Review
                    </button>
                </div>
                <div class="stash-scribe-result" data-role="result" hidden>
                    <label class="stash-scribe-label">Review</label>
                    <textarea class="stash-scribe-review" data-role="review" rows="10"></textarea>
                    <div class="stash-scribe-scores" data-role="scores"></div>
                    <div class="stash-scribe-result-actions">
                        <button type="button" class="stash-scribe-secondary" data-role="back">Back to interview</button>
                        <button type="button" class="stash-scribe-primary" data-role="save">Save</button>
                    </div>
                </div>
            </div>
        `;
        return overlay;
    }

    /* Surface a clearer hint for the most common failure mode
       (Ollama not running / unreachable). Everything else falls
       through unchanged. Used by the modal's error banner.
       Mirrors binge's scribe/ScribeModal friendlyError() so the
       two clients describe the same failure the same way. */
    function friendlyError(e) {
        const msg = (e && e.message) ? e.message : String(e);
        if (/connection refused|ECONNREFUSED|connect.*refused|failed to (?:fetch|connect)|connection error/i.test(msg)) {
            return "Couldn't reach Ollama. Start it on the host machine to generate new reviews — existing reviews can still be edited and saved without it.";
        }
        return "Error: " + msg;
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function renderTranscript(transcriptEl, messages) {
        transcriptEl.innerHTML = "";
        for (const m of messages) {
            if (m.role === "system") continue;
            const row = document.createElement("div");
            row.className = "stash-scribe-msg stash-scribe-msg-" + m.role;
            const role = document.createElement("div");
            role.className = "stash-scribe-msg-role";
            role.textContent = m.role === "assistant" ? "Scribe" : "You";
            const body = document.createElement("div");
            body.className = "stash-scribe-msg-body";
            /* Strip the [READY_TO_GENERATE] sentinel from displayed
               text. If the assistant emitted ONLY the sentinel (it
               decided it had enough material with no closing remark),
               substitute a UX hint so the bubble doesn't look empty. */
            const raw = m.content || "";
            const cleaned = raw.replace(/\[READY_TO_GENERATE\]\s*$/i, "").trim();
            if (cleaned) {
                body.textContent = cleaned;
            } else if (/\[READY_TO_GENERATE\]/i.test(raw)) {
                body.textContent = "Ready to write the review — click Generate Review below.";
                body.classList.add("stash-scribe-msg-body-ready");
            } else {
                body.textContent = "";
            }
            row.appendChild(role);
            row.appendChild(body);
            transcriptEl.appendChild(row);
        }
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
    }

    function renderScoresUI(scoresEl, criteria, scores, sourceLabel) {
        scoresEl.innerHTML = "";
        if (!criteria.length) {
            const label = sourceLabel || "Rating plugin";
            scoresEl.innerHTML = `<div class="stash-scribe-scores-empty">${escapeHtml(label)} not configured — review will save without scores.</div>`;
            return;
        }
        const label = document.createElement("div");
        label.className = "stash-scribe-label";
        label.textContent = "Suggested scores";
        scoresEl.appendChild(label);
        for (const c of criteria) {
            const row = document.createElement("div");
            row.className = "stash-scribe-score-row";
            row.innerHTML = `
                <div class="stash-scribe-score-name">${escapeHtml(c.name)}</div>
                <input type="range" min="0" max="5" step="1" value="${scores[c.id] != null ? scores[c.id] : 0}"
                       class="stash-scribe-score-slider" data-cid="${escapeHtml(c.id)}">
                <output class="stash-scribe-score-value">${scores[c.id] != null ? scores[c.id] : "—"}</output>
                <button type="button" class="stash-scribe-score-clear" data-cid="${escapeHtml(c.id)}"
                        title="Don't write this score">×</button>
            `;
            scoresEl.appendChild(row);
            const slider = row.querySelector(".stash-scribe-score-slider");
            const output = row.querySelector(".stash-scribe-score-value");
            slider.addEventListener("input", () => {
                output.textContent = slider.value;
                scores[c.id] = parseInt(slider.value, 10);
            });
            row.querySelector(".stash-scribe-score-clear").addEventListener("click", () => {
                delete scores[c.id];
                output.textContent = "—";
                slider.value = 0;
            });
        }
    }

    async function openModal(subject, opts) {
        if (modalEl) closeModal();
        if (!subject) {
            alert("Stash Scribe: subject not found");
            return;
        }
        opts = opts || {};
        /* Auto-pick edit mode when there's an existing review and no
           in-progress session — the user almost certainly wants to
           tweak what's saved, not re-run a fresh interview. They can
           still click "Start fresh interview" inside the modal to
           switch to the interview path. opts.forceInterview overrides
           (used by the "Start fresh interview" button). */
        const _saved = loadSession(subject.sessionKey);
        const _isResume = !!(_saved && _saved.messages && _saved.messages.length >= 2);
        let editMode = !!opts.editMode;
        if (!editMode && !_isResume && subject.existingReview && !opts.forceInterview) {
            editMode = true;
        }

        const cfg = await getScribeConfig();
        const criteria = subject.criteria;

        modalEl = buildModalDOM();
        document.body.appendChild(modalEl);
        const backBtn = modalEl.querySelector('[data-role="back"]');
        if (editMode) {
            modalEl.querySelector(".stash-scribe-modal").classList.add("stash-scribe-mode-edit");
            /* In edit mode the Back button switches contexts (edit →
               interview) rather than going back to an in-progress
               interview, so relabel for clarity. backToInterview()
               handles both the in-place mode swap and the kickoff. */
            backBtn.textContent = "Start fresh interview";
            backBtn.title = "Discard this edit and run a fresh LLM interview";
        }

        const titleEl = modalEl.querySelector("#stash-scribe-title");
        titleEl.textContent = editMode
            ? `Edit review — ${subject.title.replace(/^Stash Scribe — /, "")}`
            : subject.title;

        const ctxEl = modalEl.querySelector('[data-role="context"]');
        ctxEl.textContent = subject.contextStrip;

        const transcriptEl = modalEl.querySelector('[data-role="transcript"]');
        const inputEl = modalEl.querySelector('[data-role="input"]');
        const sendBtn = modalEl.querySelector('[data-role="send"]');
        const statusEl = modalEl.querySelector('[data-role="status"]');
        const generateBtn = modalEl.querySelector('[data-role="generate"]');
        const inputRow = modalEl.querySelector('.stash-scribe-input-row');
        const resultEl = modalEl.querySelector('[data-role="result"]');
        const reviewEl = modalEl.querySelector('[data-role="review"]');
        const scoresEl = modalEl.querySelector('[data-role="scores"]');

        /* Conversation state — hydrated from a saved session if one
           exists for this subject, otherwise initialised fresh.

           System message structure (order matters for voice strength):
           1. Voice prompt — sets persona. Anchored at the top.
           2. Subject context — what the conversation is about.
           3. Workflow contract — how to run the interview.
           4. Voice reminder — last instruction the model sees before
              the user turn, defending against the workflow contract
              diluting the persona on a long generation. */
        const activeVoice = cfg.voicePrompts[cfg.defaultTone] || cfg.voicePrompts.filthy;
        const contextLabel = subject.type === "performer" ? "Performer" : "Scene";
        const voiceReminder = [
            "CRITICAL REMINDER — VOICE OVERRIDES EVERYTHING.",
            "",
            "Stay 100% in the voice defined at the very top of this system message for this entire reply. Do not let the interview structure or rules turn you into a polite interviewer.",
            "",
            "If the active voice is Filthy or Direct, every reply must read crude, vulgar, and on-voice — drop explicit words freely (tits, ass, cunt, slutty, fuckable, etc.), match the user's vulgarity, lean harder into their kinks instead of describing them clinically.",
            "",
            "Match and escalate the user's level of filth. Never sanitize, never shy away. Be the perverted friend who gets just as hard (or wet) as they do.",
        ].join("\n");
        /* Append any active kink-mode overlays AFTER the voice reminder
           so they're the last instruction the LLM sees before its
           reply — strongest attention position. Each overlay only
           activates when the subject's tags matched its trigger
           pattern (see detectActiveKinkModes). If none matched, the
           kink block is empty and the system message reads exactly
           the same as before. */
        const kinkBlock = (subject.activeKinkModes && subject.activeKinkModes.length)
            ? "\n\n" + subject.activeKinkModes.join("\n\n")
            : "";
        /* Inject the rating criteria into the interview system message
           so the LLM can structure Phase 1 around them (one question
           per criterion). Without this, the LLM doesn't know what it's
           ultimately going to be asked to score and tends to ramble
           into irrelevant tangents. */
        const criteriaBlock = (criteria && criteria.length)
            ? "Rating criteria you'll need to score at the end (cover ALL of these in Phase 1, in voice):\n" +
              criteria.map(c => "- " + c.name).join("\n") +
              "\n\n"
            : "";
        function buildSystemContent(voiceKey) {
            const voice = cfg.voicePrompts[voiceKey] || cfg.voicePrompts.filthy;
            return (
                `${voice}\n\n` +
                `${contextLabel} context:\n${subject.contextForLLM}\n\n` +
                criteriaBlock +
                `${subject.interviewContract}\n\n` +
                voiceReminder +
                kinkBlock
            );
        }
        const freshSystem = {
            role: "system",
            content: buildSystemContent(cfg.defaultTone),
        };
        const saved = loadSession(subject.sessionKey);
        const isResume = !!(saved && saved.messages && saved.messages.length >= 2);

        let messages = isResume ? saved.messages.slice() : [freshSystem];
        let generated = isResume ? (saved.generated || null) : null;
        let userExchangeCount = messages.filter(m => m.role === "user").length;
        let busy = false;
        let scores = (generated && generated.scores) ? { ...generated.scores } : {};

        function persist() {
            saveSession(subject.sessionKey, { messages, generated });
        }

        let lastBusyMsg = "";
        function setBusy(state, msg) {
            busy = state;
            sendBtn.disabled = state;
            inputEl.disabled = state;
            /* Generate is enabled the moment the user has said anything
               at all — the user decides when there's enough material,
               not the LLM. */
            generateBtn.disabled = state || userExchangeCount < 1;
            if (state) {
                lastBusyMsg = msg || "Talking to the LLM…";
                statusEl.textContent = lastBusyMsg;
            } else if (statusEl.textContent === lastBusyMsg) {
                /* Only clear if the status is still the busy message we
                   set — preserves error / "Saved." messages set by
                   callers between setBusy(true) and setBusy(false). */
                statusEl.textContent = "";
            }
        }

        async function kickoff() {
            setBusy(true, "Starting interview…");
            try {
                const reply = await callLLM(messages.concat([
                    { role: "user", content: "Begin the interview with your first question." }
                ]), cfg);
                messages.push({ role: "assistant", content: reply });
                renderTranscript(transcriptEl, messages);
                persist();
            } catch (e) {
                statusEl.textContent = friendlyError(e);
            } finally {
                setBusy(false);
                inputEl.focus();
            }
        }

        async function sendMessage() {
            if (busy) return;
            const text = (inputEl.value || "").trim();
            if (!text) return;
            messages.push({ role: "user", content: text });
            inputEl.value = "";
            userExchangeCount += 1;
            renderTranscript(transcriptEl, messages);
            persist();
            setBusy(true);
            try {
                const reply = await callLLM(messages, cfg);
                messages.push({ role: "assistant", content: reply });
                renderTranscript(transcriptEl, messages);
                persist();
            } catch (e) {
                statusEl.textContent = friendlyError(e);
            } finally {
                setBusy(false);
                generateBtn.disabled = userExchangeCount < 1;
                inputEl.focus();
            }
        }

        async function generate() {
            if (busy) return;
            setBusy(true, "Writing the review…");
            try {
                const criteriaList = criteria.length
                    ? "Criteria to score (give an integer 0–5 for each):\n" +
                      criteria.map(c => "- " + c.name).join("\n")
                    : "No rating criteria configured — output the REVIEW section only and skip SCORES.";
                /* Voice prompt is already in the conversation from the
                   interview phase, so this system message only needs the
                   review-phase workflow contract + criteria list. */
                const genMessages = messages.concat([
                    { role: "system", content: subject.reviewContract + "\n\n" + criteriaList },
                    { role: "user", content: "Generate the review now." },
                ]);
                const reply = await callLLM(genMessages, cfg);
                const parsed = parseGenerated(reply, criteria);
                reviewEl.value = parsed.review;
                scores = parsed.scores;
                generated = { review: parsed.review, scores: { ...scores } };
                renderScoresUI(scoresEl, criteria, scores, subject.criteriaSourceLabel);
                showResultPane();
                persist();
            } catch (e) {
                console.error("[stashScribe] generate failed:", e);
                statusEl.textContent = friendlyError(e);
            } finally {
                setBusy(false);
            }
        }

        /* Intro pane — shown only on a brand-new open with no existing
           review and no resumable session. Hides the transcript /
           input / actions until the user explicitly picks a path.
           Avoids hitting Ollama on open so a missing/offline LLM
           server doesn't break the modal. */
        function showIntroPane() {
            const introEl = modalEl.querySelector('[data-role="intro"]');
            const actionsEl = modalEl.querySelector('.stash-scribe-actions');
            introEl.hidden = false;
            transcriptEl.hidden = true;
            inputRow.hidden = true;
            actionsEl.hidden = true;
            resultEl.hidden = true;

            /* Build the voice picker from the same options the
               settings panel offers. The choice persists for the
               duration of the modal session (not to plugin config). */
            const toneSelect = introEl.querySelector('[data-role="intro-tone"]');
            toneSelect.innerHTML = "";
            for (const v of VOICE_MODES) {
                const opt = document.createElement("option");
                opt.value = v;
                opt.textContent = VOICE_LABELS[v];
                if (v === cfg.defaultTone) opt.selected = true;
                toneSelect.appendChild(opt);
            }
            toneSelect.onchange = () => {
                /* Rebuild the system message with the chosen voice.
                   Mutates `freshSystem.content` in place — messages[0]
                   IS freshSystem on the fresh-open path, so the kicked-
                   off conversation sees the new voice. */
                freshSystem.content = buildSystemContent(toneSelect.value);
            };

            introEl.querySelector('[data-role="intro-manual"]').onclick = () => {
                /* Manual path: jump straight into the result pane
                   with an empty review + empty scores, treated like
                   edit mode. Sets the back button label so its
                   confirm() prompt makes sense if the user later
                   wants to switch to the LLM interview. */
                introEl.hidden = true;
                modalEl.querySelector(".stash-scribe-modal").classList.add("stash-scribe-mode-edit");
                if (backBtn) {
                    backBtn.textContent = "Start LLM interview";
                    backBtn.title = "Discard this manual review and run an LLM interview instead";
                }
                editMode = true;
                generated = { review: "", scores: {} };
                scores = {};
                reviewEl.value = "";
                renderScoresUI(scoresEl, criteria, scores, subject.criteriaSourceLabel);
                showResultPane();
                statusEl.textContent = "Manual mode — type the review, set scores, save.";
                reviewEl.focus();
            };

            introEl.querySelector('[data-role="intro-llm"]').onclick = () => {
                /* LLM path: hide intro, show interview chrome, kick
                   off the first model turn. If Ollama is down, the
                   error surfaces in the status row with a friendly
                   hint — modal stays usable, user can close or pick
                   Start over to come back to the intro. */
                introEl.hidden = true;
                transcriptEl.hidden = false;
                inputRow.hidden = false;
                actionsEl.hidden = false;
                kickoff();
            };
        }

        function showResultPane() {
            inputRow.hidden = true;
            modalEl.querySelector('.stash-scribe-actions').hidden = true;
            resultEl.hidden = false;
            /* If we got here without running an interview (existing
               review loaded straight from custom_fields), hide the
               empty transcript area — otherwise its `flex: 1 1 auto`
               + 180px min-height squeezes the result pane into a tiny
               slice at the bottom of the modal. */
            const visibleMessages = messages.filter(m => m.role !== "system").length;
            transcriptEl.hidden = visibleMessages === 0;
        }

        function backToInterview() {
            const modalCard = modalEl.querySelector(".stash-scribe-modal");
            const wasEditMode = modalCard.classList.contains("stash-scribe-mode-edit");
            if (wasEditMode) {
                if (!confirm("Discard this edit and start a fresh interview? The currently saved review on the scene/performer stays untouched until you save a new one.")) return;
                /* Leave edit mode — restore the interview-flow UI. */
                modalCard.classList.remove("stash-scribe-mode-edit");
                titleEl.textContent = subject.title;
                /* Reset the Back button label back to its interview-mode meaning. */
                const backBtnEl = modalEl.querySelector('[data-role="back"]');
                if (backBtnEl) {
                    backBtnEl.textContent = "Back to interview";
                    backBtnEl.title = "";
                }
                /* Reset conversation + state for a true fresh start. */
                clearSession(subject.sessionKey);
                messages = [freshSystem];
                userExchangeCount = 0;
                scores = {};
            }
            inputRow.hidden = false;
            modalEl.querySelector('.stash-scribe-actions').hidden = false;
            resultEl.hidden = true;
            transcriptEl.hidden = false;
            /* Drop the generated pane state — user is going back to
               refine via more questions, so any saved scores would be
               stale once they re-generate. */
            generated = null;
            persist();
            inputEl.focus();
            /* If the transcript is empty (fresh edit-mode → interview
               transition, or existing-review preload), kick off. */
            if (messages.filter(m => m.role !== "system").length === 0) {
                kickoff();
            }
        }

        async function save({ withScores }) {
            setBusy(true, "Saving…");
            try {
                const reviewText = reviewEl.value;
                const scoresToWrite = withScores ? scores : {};
                /* Keep latest edits in the saved session until the
                   write is confirmed — if the GraphQL write fails the
                   user shouldn't lose what they typed. */
                if (generated) {
                    generated.review = reviewText;
                    generated.scores = { ...scores };
                    persist();
                }
                await subject.save({
                    reviewText,
                    scoresByCriterion: scoresToWrite,
                    autoCreate: cfg.autoCreateTags,
                });
                clearSession(subject.sessionKey);
                statusEl.textContent = "Saved.";
                /* Re-inject the on-page review section so the new
                   review shows immediately (no page refresh needed). */
                startReviewSectionPolling(subject.type, subject.id);
                setTimeout(closeModal, 400);
            } catch (e) {
                console.error("[stashScribe] save failed:", e);
                statusEl.textContent = "Save failed: " + e.message;
                setBusy(false);
            }
        }

        async function startOver() {
            if (!confirm("Discard this session and start a fresh interview?")) return;
            clearSession(subject.sessionKey);
            closeModal();
            try {
                const fresh = subject.type === "performer"
                    ? await buildPerformerSubject(subject.id)
                    : await buildSceneSubject(subject.id);
                if (fresh) openModal(fresh);
            } catch (err) {
                console.error("[stashScribe] startOver build failed:", err);
                alert("Stash Scribe: couldn't restart. " + (err && err.message ? err.message : ""));
            }
        }

        sendBtn.addEventListener("click", sendMessage);
        inputEl.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        generateBtn.addEventListener("click", generate);
        modalEl.querySelector('[data-role="back"]').addEventListener("click", backToInterview);
        /* Save always includes whichever scores are currently set in
           the sliders. Users can clear individual scores via the × on
           each row before saving if they disagree with the LLM. */
        modalEl.querySelector('[data-role="save"]').addEventListener("click", () => save({ withScores: true }));
        modalEl.querySelector('[data-role="restart"]').addEventListener("click", startOver);
        modalEl.querySelector(".stash-scribe-close").addEventListener("click", closeModal);
        modalEl.addEventListener("click", e => {
            if (e.target === modalEl) closeModal();
        });
        document.addEventListener("keydown", escClose);

        /* Persist textarea edits + score-slider tweaks made in the
           result pane so they survive a close/reopen even before
           the user clicks Save. */
        reviewEl.addEventListener("input", () => {
            if (!generated) generated = { review: "", scores: {} };
            generated.review = reviewEl.value;
            persist();
        });
        scoresEl.addEventListener("input", () => {
            if (generated) {
                generated.scores = { ...scores };
                persist();
            }
        });

        if (editMode) {
            /* Quick-edit path — no interview, no session resume. Pre-fill
               the textarea with the existing review and the sliders with
               current scores read from the subject's tags. */
            const initial = subject.existingReview || "";
            generated = { review: initial, scores: { ...(subject.currentScores || {}) } };
            scores = generated.scores;
            reviewEl.value = initial;
            renderScoresUI(scoresEl, criteria, scores, subject.criteriaSourceLabel);
            showResultPane();
        } else if (isResume) {
            renderTranscript(transcriptEl, messages);
            generateBtn.disabled = userExchangeCount < 1;
            statusEl.textContent = "Resumed previous session.";
            if (generated && generated.review != null) {
                reviewEl.value = generated.review;
                renderScoresUI(scoresEl, criteria, scores, subject.criteriaSourceLabel);
                showResultPane();
            }
            inputEl.focus();
        } else if (subject.existingReview) {
            /* No in-progress session — but the subject might already
               have a saved review from a previous Scribe run. If so,
               jump straight to the result pane so the user can edit
               it instead of running a fresh interview. */
            generated = { review: subject.existingReview, scores: {} };
            reviewEl.value = subject.existingReview;
            renderScoresUI(scoresEl, criteria, scores, subject.criteriaSourceLabel);
            showResultPane();
            statusEl.textContent = "Loaded existing review — edit + save, or click Back to start a fresh interview.";
        } else {
            /* Fresh open with no existing review and no resumable
               session: show the intro screen instead of immediately
               firing the LLM. Lets the user pick LLM-interview vs.
               manual writing — so the modal stays usable when
               Ollama is offline or the user doesn't want to load a
               model on the host machine. */
            showIntroPane();
        }
    }

    function escClose(e) {
        if (e.key === "Escape" && modalEl) closeModal();
    }

    function closeModal() {
        if (modalEl) modalEl.remove();
        modalEl = null;
        document.removeEventListener("keydown", escClose);
    }

    /* ── Trigger injection ───────────────────────────────────────────── */

    let pollTimer = null;
    let lastPath = null;

    /* ── Rendered review section ─────────────────────────────────────
       Polls the detail page for the right anchor and injects a
       read-only section showing the saved Stash Scribe review below
       the existing Details block. Re-fired after a save so the page
       reflects the new review without a manual reload. */

    let reviewSectionTimer = null;

    async function fetchReviewForSubject(subjectType, id) {
        const query = subjectType === "performer"
            ? `query ScribeReviewPerformer($id: ID!) { findPerformer(id: $id) { custom_fields details } }`
            : `query ScribeReviewScene($id: ID!) { findScene(id: $id) { custom_fields details } }`;
        const res = await gqlClient(query, { id });
        const obj = res && res.data && res.data[subjectType === "performer" ? "findPerformer" : "findScene"];
        if (!obj) return null;
        const cf = obj.custom_fields || {};
        if (cf[REVIEW_FIELD_KEY]) return String(cf[REVIEW_FIELD_KEY]).trim();
        const fromDetails = extractReviewFromDetails(obj.details || "");
        return fromDetails || null;
    }

    /* Anchor strategy depends on subject type:
       - Scenes: flat `<h6>Details:</h6><p class="pre">...</p>` pattern.
         Walk h6/h5 looking for "Details", then insert before the
         next heading sibling (typically "Tags").
       - Performers: `.detail-item.details` div with title/value spans
         (no h6 heading). Insert immediately after that block. */
    /* Scene-page sibling-row insertion. Preferred position is
       BEFORE Refract's lifted .scene-performers-row sibling — that
       puts the review between the textual details and the performer
       cards. Without Refract, scene-performers stays inside .col-12;
       fall back to "after the row containing scene-performers" so we
       still land near the cards. Final fallback: after the Details
       heading's row. We never modify col-12's children directly —
       that's what breaks React's reconciler. */
    /* Find an anchor on the scene detail panel to inject the review
       section. Preferred: just after the Details prose. Fallbacks for
       scenes without a Details heading (self-titled .mp4s, etc.):
       insert before the Tags heading, then before the auto-rendered
       Custom Fields panel, then at the very end of the active pane. */
    function findReviewSectionAnchor(subjectType /*, allowFallback */) {
        if (subjectType === "performer") {
            const detailsRow = document.querySelector(".detail-item.details");
            if (detailsRow) return { el: detailsRow, position: "afterend", pattern: "detail-item" };
            return null;
        }
        const activePane = document.querySelector(".scene-tabs .tab-pane.active");
        if (!activePane) return null;
        const headings = Array.from(activePane.querySelectorAll("h6, .h6, h5, .h5"));

        /* 1. Right after the Details prose if a Details heading exists. */
        for (const h of headings) {
            const text = (h.textContent || "").trim();
            if (!/^details\b/i.test(text)) continue;
            let lastBodyEl = h;
            let next = h.nextElementSibling;
            while (next) {
                if (next.id === "stash-scribe-review-section") {
                    next = next.nextElementSibling;
                    continue;
                }
                const isHeading =
                    /^H[1-6]$/i.test(next.tagName) ||
                    next.classList.contains("h6") ||
                    next.classList.contains("h5");
                if (isHeading) break;
                lastBodyEl = next;
                next = next.nextElementSibling;
            }
            return { el: lastBodyEl, position: "afterend", pattern: "h6-pre" };
        }

        /* 2. No Details — try landing just before the Tags heading.
           Picks up scenes with empty details but visible tags. */
        for (const h of headings) {
            const text = (h.textContent || "").trim();
            if (/^tags\b/i.test(text)) {
                return { el: h, position: "beforebegin", pattern: "h6-pre" };
            }
        }

        /* 3. No Tags either — slot in just before the auto-rendered
           Custom Fields panel. */
        const customFields = activePane.querySelector(".custom-fields.full-width");
        if (customFields) {
            return { el: customFields, position: "beforebegin", pattern: "h6-pre" };
        }

        /* 4. Last resort — append at the end of the first content row
           in the active pane. */
        const firstContentRow = activePane.querySelector(".row .col-12, .col-12");
        if (firstContentRow) {
            return { el: firstContentRow, position: "beforeend", pattern: "h6-pre" };
        }
        return null;
    }

    function removeReviewSection() {
        const existing = document.querySelector("#stash-scribe-review-section");
        if (existing) existing.remove();
    }

    function makeEditButton(subjectType, id) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "minimal btn btn-link stash-scribe-review-edit";
        editBtn.title = "Edit this review";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", async e => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const subject = subjectType === "performer"
                    ? await buildPerformerSubject(id)
                    : await buildSceneSubject(id);
                openModal(subject, { editMode: true });
            } catch (err) {
                console.error("[stashScribe] failed to build subject for edit:", err);
                alert("Stash Scribe: couldn't load this " + subjectType + ". " + (err && err.message ? err.message : ""));
            }
        });
        return editBtn;
    }

    /* Build the review section to match whichever native pattern the
       host page uses, so it reads as a peer of the surrounding sections:
       - h6-pre  (scene page): `<h6>Heading</h6><p class="pre">prose</p>`
       - detail-item (performer page): `<div class="detail-item">
         <span class="detail-item-title">Heading:</span>
         <span class="detail-item-value">prose</span></div>` */
    function buildReviewSectionDOM(reviewText, subjectType, id, pattern) {
        if (pattern === "detail-item") {
            /* Performer-page detail-item: native Stash CSS puts the
               title in a narrow left column. Keep the title plain
               text (no Edit button inside it) — putting a flex'd
               button there breaks the column layout. Edit lives at
               the end of the value span instead. */
            const wrapper = document.createElement("div");
            wrapper.id = "stash-scribe-review-section";
            wrapper.className = "stash-scribe-review-section detail-item";
            const title = document.createElement("span");
            title.className = "detail-item-title";
            title.textContent = "Scribe Review:";
            const value = document.createElement("span");
            value.className = "detail-item-value stash-scribe-review-body";
            /* Prose first as a text node, then the Edit affordance.
               The button's CSS positions it inline at the end. */
            value.appendChild(document.createTextNode(reviewText));
            const editLine = document.createElement("div");
            editLine.className = "stash-scribe-review-edit-row";
            editLine.appendChild(makeEditButton(subjectType, id));
            value.appendChild(editLine);
            wrapper.appendChild(title);
            wrapper.appendChild(value);
            return wrapper;
        }
        /* h6-pre pattern (scene page). Inserts inside .col-12 as a
           sibling of the native h6+content pairs, so it inherits the
           same Refract/Stash typography automatically. The wrapper div
           identifies our injection for removal but stays out of the
           visual flow (display: contents or just plain wrapper). */
        const wrapper = document.createElement("div");
        wrapper.id = "stash-scribe-review-section";
        wrapper.className = "stash-scribe-review-section";
        const heading = document.createElement("h6");
        heading.className = "stash-scribe-review-heading";
        const titleSpan = document.createElement("span");
        titleSpan.textContent = "Scribe Review";
        heading.appendChild(titleSpan);
        heading.appendChild(makeEditButton(subjectType, id));
        const body = document.createElement("p");
        body.className = "pre stash-scribe-review-body";
        body.textContent = reviewText;
        wrapper.appendChild(heading);
        wrapper.appendChild(body);
        return wrapper;
    }

    async function startReviewSectionPolling(subjectType, id) {
        if (reviewSectionTimer) { clearInterval(reviewSectionTimer); reviewSectionTimer = null; }
        let reviewText;
        try {
            reviewText = await fetchReviewForSubject(subjectType, id);
        } catch (err) {
            /* Network blip / GraphQL error — silently skip the on-page
               section render rather than spamming an unhandled promise
               rejection. The user can still open the modal via the
               trigger button to retry. */
            console.warn("[stashScribe] fetchReviewForSubject failed:", err);
            return;
        }
        if (!reviewText) {
            removeReviewSection();
            return;
        }
        let attempts = 0;
        reviewSectionTimer = setInterval(() => {
            attempts += 1;
            if (attempts >= 60) { /* ~6s, give up */
                clearInterval(reviewSectionTimer);
                reviewSectionTimer = null;
                return;
            }
            const anchor = findReviewSectionAnchor(subjectType);
            if (!anchor) return;
            removeReviewSection();
            const section = buildReviewSectionDOM(reviewText, subjectType, id, anchor.pattern);
            anchor.el.insertAdjacentElement(anchor.position, section);
            clearInterval(reviewSectionTimer);
            reviewSectionTimer = null;
        }, 100);
    }

    /* Anchor selectors per subject type. Scenes attach after the
       Advanced Rating plugin's scene trigger (or fall back to the
       rating-stars element). Performers attach after the same plugin's
       performer trigger which lives in `.quality-group`. */
    function findAnchor(subjectType) {
        if (subjectType === "performer") {
            return document.querySelector(".quality-group #adv-rating-trigger") ||
                   document.querySelector(".quality-group .rating-stars, .quality-group .rating-number");
        }
        return document.querySelector(".scene-toolbar #adv-favourite-trigger") ||
               document.querySelector(".scene-toolbar #adv-rating-trigger") ||
               document.querySelector(".scene-toolbar .rating-stars, .scene-toolbar .rating-number");
    }

    function tryInject(subjectType, id) {
        if (document.querySelector("#stash-scribe-trigger")) return true;
        const anchor = findAnchor(subjectType);
        if (!anchor) return false;
        injectTrigger(anchor, subjectType, id);
        return true;
    }

    function injectTrigger(anchor, subjectType, id) {
        const btn = document.createElement("button");
        btn.id = "stash-scribe-trigger";
        btn.type = "button";
        btn.className = "stash-scribe-trigger-btn";
        btn.title = subjectType === "performer"
            ? "Write performer review with Stash Scribe"
            : "Write review with Stash Scribe";
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                '<path d="M3 21l3.5-1 11-11-2.5-2.5-11 11L3 21z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
                '<path d="M14.5 6.5l3-3 2.5 2.5-3 3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
            '</svg>';
        anchor.insertAdjacentElement("afterend", btn);
        btn.addEventListener("click", async e => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const subject = subjectType === "performer"
                    ? await buildPerformerSubject(id)
                    : await buildSceneSubject(id);
                openModal(subject);
            } catch (err) {
                console.error("[stashScribe] failed to build subject for trigger:", err);
                alert("Stash Scribe: couldn't load this " + subjectType + ". " + (err && err.message ? err.message : ""));
            }
        });
    }

    function startPolling(subjectType, id) {
        if (pollTimer) clearInterval(pollTimer);
        let attempts = 0;
        pollTimer = setInterval(() => {
            attempts += 1;
            if (tryInject(subjectType, id) || attempts >= 40) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }, 100);
    }

    function removeTrigger() {
        const existing = document.querySelector("#stash-scribe-trigger");
        if (existing) existing.remove();
    }

    function onLocationChange() {
        const path = window.location.pathname;
        const sceneMatch = path.match(/\/scenes\/(\d+)/);
        const perfMatch = path.match(/\/performers\/(\d+)/);
        const isEdit = path.includes("edit");
        let subjectType = null, id = null;
        if (sceneMatch && !isEdit) { subjectType = "scene"; id = sceneMatch[1]; }
        else if (perfMatch && !isEdit) { subjectType = "performer"; id = perfMatch[1]; }
        if (subjectType) {
            if (path !== lastPath) {
                lastPath = path;
                removeTrigger();
                removeReviewSection();
                startPolling(subjectType, id);
                startReviewSectionPolling(subjectType, id);
            }
        } else {
            lastPath = null;
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            if (reviewSectionTimer) { clearInterval(reviewSectionTimer); reviewSectionTimer = null; }
            removeTrigger();
            removeReviewSection();
            if (modalEl) closeModal();
        }
    }

    PluginApi.Event.addEventListener("stash:location", onLocationChange);
    onLocationChange();

    /* ── Settings panel ──────────────────────────────────────────────── */

    function buildSettingsPanel() {
        const { React } = PluginApi;
        return function ScribeSettingsPanel() {
            const [cfg, setCfg] = React.useState(null);
            const [status, setStatus] = React.useState("");
            const [editingMode, setEditingMode] = React.useState("direct");
            const [models, setModels] = React.useState(null); /* null = not loaded, [] = loaded empty, [...] = loaded */
            const [modelsError, setModelsError] = React.useState("");
            const saveTimerRef = React.useRef(null);

            const refreshModels = React.useCallback(async (ollamaUrl) => {
                setModels(null);
                setModelsError("");
                try {
                    const list = await listModels({ ollamaUrl });
                    setModels(list);
                } catch (e) {
                    setModels([]);
                    setModelsError(e.message || "Failed to list models");
                }
            }, []);

            React.useEffect(() => {
                getScribeConfig().then(c => {
                    setCfg(c);
                    setEditingMode(c.defaultTone);
                    refreshModels(c.ollamaUrl);
                });
                return () => {
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                };
            }, []);

            const h = React.createElement;

            if (!cfg) {
                return h("div", { className: "plugin-settings" }, "Loading…");
            }

            /* Stash's configurePlugin REPLACES the full input map for
               this plugin's namespace — partial updates wipe other
               keys. So every save round-trips the full config snapshot.
               Calls are debounced 350ms so rapid typing in a textarea
               doesn't hammer GraphQL. Legacy `interviewSystem`/
               `reviewSystem` keys are intentionally NOT carried forward
               — replacing the map drops them, which is the migration. */
            function persist(next) {
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                saveTimerRef.current = setTimeout(async () => {
                    try {
                        await configurePlugin({
                            ollamaUrl: next.ollamaUrl,
                            model: next.model,
                            defaultTone: next.defaultTone,
                            autoCreateTags: !!next.autoCreateTags,
                            voicePrompt_direct:  next.voicePrompts.direct,
                            voicePrompt_sensual: next.voicePrompts.sensual,
                            voicePrompt_filthy:  next.voicePrompts.filthy,
                            contextOverlaysJson: next.contextOverlaysJson || "",
                        });
                        setStatus("Saved.");
                        setTimeout(() => setStatus(s => s === "Saved." ? "" : s), 1500);
                    } catch (e) {
                        setStatus("Save failed: " + e.message);
                    }
                }, 350);
            }

            function update(patch) {
                setCfg(prev => {
                    const next = { ...prev, ...patch };
                    persist(next);
                    return next;
                });
            }

            async function testConnection() {
                setStatus("Testing Ollama connection…");
                try {
                    const models = await listModels({ ollamaUrl: cfg.ollamaUrl });
                    if (!models.length) {
                        setStatus("Connected — no models found. Pull one with `ollama pull <model>`.");
                        return;
                    }
                    setStatus(`Connected — ${models.length} model${models.length === 1 ? "" : "s"}: ${models.slice(0, 5).join(", ")}${models.length > 5 ? "…" : ""}`);
                } catch (e) {
                    setStatus("Connection failed: " + e.message);
                }
            }

            /* Helper: build a Stash-native .setting row (title +
               sub-heading on the left, control on the right). */
            function settingRow(id, title, description, control) {
                return h("div", { className: "setting", id: "plugin-stash-scribe-" + id },
                    h("div", null,
                        h("h3", null, title),
                        description ? h("div", { className: "sub-heading" }, description) : null
                    ),
                    h("div", { className: "stash-scribe-control" }, control)
                );
            }

            function textRow(id, title, description, key, placeholder) {
                return settingRow(id, title, description,
                    h("input", {
                        type: "text",
                        className: "form-control",
                        defaultValue: cfg[key] || "",
                        placeholder,
                        onBlur: e => {
                            if ((cfg[key] || "") !== e.target.value) {
                                update({ [key]: e.target.value });
                            }
                        },
                    })
                );
            }

            function selectRow(id, title, description, key, options) {
                return settingRow(id, title, description,
                    h("select", {
                        className: "form-control",
                        value: cfg[key],
                        onChange: e => update({ [key]: e.target.value }),
                    }, options.map(o =>
                        h("option", { key: o.value, value: o.value }, o.label)
                    ))
                );
            }

            function switchRow(id, title, description, key) {
                const elId = "stash-scribe-switch-" + id;
                return settingRow(id, title, description,
                    h("div", { className: "custom-control custom-switch" },
                        h("input", {
                            type: "checkbox",
                            className: "custom-control-input",
                            id: elId,
                            checked: !!cfg[key],
                            onChange: e => update({ [key]: e.target.checked }),
                        }),
                        h("label", { className: "custom-control-label", htmlFor: elId })
                    )
                );
            }

            function modelRow() {
                /* Build the model select. If models haven't loaded yet,
                   show a placeholder. If load failed, fall back to a
                   text input so the user can still type a model tag.
                   Always include the currently-saved model as an option
                   even if it's not in the live `models` list (Ollama
                   might be offline at this moment). */
                const control = (function () {
                    if (models === null) {
                        return h("div", { className: "stash-scribe-models-loading" }, "Loading models…");
                    }
                    if (modelsError) {
                        return h("div", null,
                            h("input", {
                                type: "text",
                                className: "form-control",
                                defaultValue: cfg.model || "",
                                placeholder: DEFAULT_MODEL,
                                onBlur: e => {
                                    if ((cfg.model || "") !== e.target.value) update({ model: e.target.value });
                                },
                            }),
                            h("div", { className: "stash-scribe-models-error" },
                                "Ollama not reachable — " + modelsError + ". Edit the tag manually."
                            )
                        );
                    }
                    const options = models.slice();
                    if (cfg.model && options.indexOf(cfg.model) === -1) options.unshift(cfg.model);
                    if (options.length === 0) {
                        return h("div", { className: "stash-scribe-models-empty" },
                            "Ollama is up but no models found. Pull one with `ollama pull <model>`."
                        );
                    }
                    /* Native Stash plugin-reload-button icon — matches
                       the look of Stash's `.st-plugin-reload-btn`. */
                    const refreshIcon = h("svg", {
                        viewBox: "0 0 512 512",
                        "aria-hidden": "true",
                        className: "svg-inline--fa fa-rotate fa-icon",
                    }, h("path", {
                        fill: "currentColor",
                        d: "M480.1 192l7.9 0c13.3 0 24-10.7 24-24l0-144c0-9.7-5.8-18.5-14.8-22.2S477.9 .2 471 7L419.3 58.8C375 22.1 318 0 256 0 127 0 20.3 95.4 2.6 219.5 .1 237 12.2 253.2 29.7 255.7s33.7-9.7 36.2-27.1C79.2 135.5 159.3 64 256 64 300.4 64 341.2 79 373.7 104.3L327 151c-6.9 6.9-8.9 17.2-5.2 26.2S334.3 192 344 192l136.1 0zm29.4 100.5c2.5-17.5-9.7-33.7-27.1-36.2s-33.7 9.7-36.2 27.1c-13.3 93-93.4 164.5-190.1 164.5-44.4 0-85.2-15-117.7-40.3L185 361c6.9-6.9 8.9-17.2 5.2-26.2S177.7 320 168 320L24 320c-13.3 0-24 10.7-24 24L0 488c0 9.7 5.8 18.5 14.8 22.2S34.1 511.8 41 505l51.8-51.8C137 489.9 194 512 256 512 385 512 491.7 416.6 509.4 292.5z",
                    }));
                    return h("div", { className: "stash-scribe-model-picker" },
                        h("select", {
                            className: "form-control",
                            value: cfg.model || options[0],
                            onChange: e => update({ model: e.target.value }),
                        }, options.map(m =>
                            h("option", { key: m, value: m }, m)
                        )),
                        h("button", {
                            type: "button",
                            className: "btn btn-primary stash-scribe-models-refresh",
                            title: "Re-query Ollama for available models",
                            "aria-label": "Refresh model list",
                            onClick: () => refreshModels(cfg.ollamaUrl),
                        }, h("span", { className: "fa-icon" }, refreshIcon))
                    );
                })();
                return settingRow("model",
                    "Model",
                    "Ollama model tag. Pulled live from /api/tags — pick whichever you've already downloaded.",
                    control
                );
            }

            return h("div", { className: "plugin-settings stash-scribe-settings" },
                textRow("ollama-url",
                    "Ollama URL",
                    "Base URL Ollama listens on. The Python proxy calls this from inside Stash, so a localhost address is fine — no need to expose Ollama publicly.",
                    "ollamaUrl", DEFAULT_OLLAMA_URL),
                modelRow(),
                selectRow("default-tone",
                    "Default tone",
                    "Picks which voice prompt is active when you open a new review. Each mode has its own prompt — edit them below.",
                    "defaultTone",
                    VOICE_MODES.map(m => ({ value: m, label: VOICE_LABELS[m] }))
                ),
                switchRow("auto-create-tags",
                    "Auto-create missing criterion tags",
                    "When saving scores, create any \"<Name> ★: <0-5>\" tags that don't exist yet (auto_tag disabled on the tag).",
                    "autoCreateTags"),

                /* Voice-prompt editor — one textarea, swappable across
                   the three modes via a tab row above it. The workflow
                   instructions (interview steps, REVIEW:/SCORES: output
                   format) are appended programmatically at runtime, so
                   the prompts here only describe the persona. */
                h("div", { className: "stash-scribe-prompt-section", id: "plugin-stash-scribe-voice-prompts" },
                    h("h3", null, "Voice prompts"),
                    h("div", { className: "sub-heading" },
                        "Each tone has its own voice. The interview workflow and final REVIEW:/SCORES: output format are appended automatically — describe ONLY the persona here. Anything workflow-related (\"ask one question at a time\", \"end with [READY_TO_GENERATE]\") will fight with the appended contract and dilute the voice signal."),
                    h("div", { className: "stash-scribe-mode-tabs" },
                        VOICE_MODES.map(mode =>
                            h("button", {
                                key: mode,
                                type: "button",
                                className: "btn btn-secondary" + (editingMode === mode ? " active" : ""),
                                onClick: () => setEditingMode(mode),
                            }, VOICE_LABELS[mode] + (cfg.defaultTone === mode ? " (default)" : ""))
                        ),
                        h("button", {
                            type: "button",
                            className: "btn btn-link stash-scribe-reset-voice",
                            title: "Replace this tone's prompt with the shipped default",
                            onClick: () => {
                                if (!confirm(`Reset the "${VOICE_LABELS[editingMode]}" voice prompt to its shipped default? This overwrites whatever you've customised for this tone.`)) return;
                                update({
                                    voicePrompts: {
                                        ...cfg.voicePrompts,
                                        [editingMode]: DEFAULT_VOICES[editingMode],
                                    },
                                });
                            },
                        }, "Reset to default")
                    ),
                    h("textarea", {
                        /* `key` forces React to remount the textarea
                           whenever the active mode changes or the
                           prompt is reset — otherwise defaultValue
                           is cached on the previous content and the
                           user sees stale text. */
                        key: "voice-textarea-" + editingMode + "-" + (cfg.voicePrompts[editingMode] || "").length,
                        className: "form-control stash-scribe-prompt-textarea",
                        defaultValue: cfg.voicePrompts[editingMode],
                        rows: 14,
                        onBlur: e => {
                            if (cfg.voicePrompts[editingMode] !== e.target.value) {
                                update({
                                    voicePrompts: {
                                        ...cfg.voicePrompts,
                                        [editingMode]: e.target.value,
                                    },
                                });
                            }
                        },
                    })
                ),

                /* Context overlays: optional kink/tag-triggered prompt
                   extensions. JSON array of {trigger, text} objects;
                   trigger is a regex string tested case-insensitively
                   against the subject's tag names. Empty by default —
                   each user defines their own privately. Lives only in
                   Stash's local plugin config; the repo ships empty. */
                h("div", { className: "stash-scribe-prompt-section", id: "plugin-stash-scribe-context-overlays" },
                    h("h3", null, "Context overlays"),
                    h("div", { className: "sub-heading" },
                        "Optional. JSON array of `{trigger, text}` entries. Each entry's `trigger` regex is tested (case-insensitive) against the scene/performer tag names; matching entries' `text` is appended to the system prompt for that review. Use this to add tag-triggered voice extensions for specific kinks or moods. Example: `[{\"trigger\": \"\\\\b(massage|spa)\\\\b\", \"text\": \"MASSAGE MODE — focus on the slow build and warm-oil eroticism.\"}]`"),
                    h("textarea", {
                        className: "form-control stash-scribe-prompt-textarea",
                        defaultValue: cfg.contextOverlaysJson || "",
                        rows: 12,
                        spellCheck: false,
                        placeholder: '[\n  {\n    "trigger": "\\\\b(massage|spa)\\\\b",\n    "text": "..."\n  }\n]',
                        onBlur: e => {
                            if ((cfg.contextOverlaysJson || "") !== e.target.value) {
                                update({ contextOverlaysJson: e.target.value });
                            }
                        },
                    })
                ),

                h("div", { className: "stash-scribe-test-row" },
                    h("button", {
                        type: "button",
                        className: "btn btn-secondary",
                        onClick: testConnection,
                    }, "Test connection"),
                    status
                        ? h("span", { className: "stash-scribe-status" }, status)
                        : null
                )
            );
        };
    }

    function registerSettingsPatch() {
        if (!PluginApi || !PluginApi.patch || !PluginApi.React) {
            setTimeout(registerSettingsPatch, 100);
            return;
        }
        const Panel = buildSettingsPanel();
        PluginApi.patch.instead("PluginSettings", function () {
            const args = Array.prototype.slice.call(arguments);
            const next = args.pop();
            const props = args[0];
            const incomingId = props && (props.pluginID || props.pluginId || props.id);
            if (incomingId !== PLUGIN_ID) return next.apply(null, args);
            return PluginApi.React.createElement(Panel);
        });
    }
    registerSettingsPatch();
})();
