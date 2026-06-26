/* Refract Cards — standalone card styling extracted from the Refract theme
   so cards look like Refract on top of the default Stash theme. The base
   card look (glass surfaces, borders, hover glow, 3D tilt, rating banners,
   performer avatar circles, performer-card redesign) is always on while the
   plugin is active; the per-card-type settings control only the rating
   layer on top (tier frames / playing-card layout).

   Settings → Plugins → Refract Cards:
     • Scene cards:     Plain | Tier frames
     • Performer cards: Plain | Tier frames | Playing card

   The big middle section of this file is lifted from Refract's refract.js
   (its card subsystem), with the rating-style/system body classes renamed
   to the refract-cards-* namespace. */
(function () {
    "use strict";

    var PLUGIN_ID = "refract-cards";

    function addScope() {
        try {
            if (document.documentElement) { document.documentElement.classList.add("refract-cards"); }
            if (document.body) { document.body.classList.add("refract-cards"); }
        } catch (e) { /* ignore */ }
    }
    addScope();

    /* ── Settings (per-browser, localStorage) ────────────────────────────
       Three independent on/off toggles. Scene cards have one fixed look
       (the classic tier-frame card); performer cards have one fixed look
       (the playing-card layout); "Other cards" applies the base Refract
       card styling (glass, hover glow, 3D tilt) to galleries, images,
       studios, tags, groups, and markers. "Off" for a group leaves those
       cards exactly as the default Stash theme draws them. */
    var PERF_KEY  = "refractCards.performers";
    var SCENE_KEY = "refractCards.scenes";
    var OTHER_KEY = "refractCards.others";
    var LITE_KEY  = "refractCards.lite";

    function getBool(key) {
        try { return localStorage.getItem(key) !== "0"; } catch (e) { return true; }  /* default ON */
    }
    function setBool(key, on) { try { localStorage.setItem(key, on ? "1" : "0"); } catch (e) { /* ignore */ } }
    function getPerfOn()  { return getBool(PERF_KEY); }
    function getSceneOn() { return getBool(SCENE_KEY); }
    function getOtherOn() { return getBool(OTHER_KEY); }
    /* Lite mode defaults OFF (opt-in), so it reads "1" explicitly rather
       than the default-ON getBool. When on, the cards keep their tier
       colours, a static tier frame, and the rating banners but drop the
       glass glow, the breathing/sheen tier animations, the hover halo,
       the 3D tilt, and the floating hearts. */
    function getLiteOn() { try { return localStorage.getItem(LITE_KEY) === "1"; } catch (e) { return false; } }

    /* Card-type classes that count as "everything else". */
    var OTHER_CARD_SELECTOR = ".gallery-card, .image-card, .studio-card, .tag-card, .scene-marker-card, .group-card, .movie-card";

    /* Body classes the extracted CSS keys off: `playing` for the performer
       playing-card layout, `tiers` for the tier-frame card treatment (scenes
       always use it; performers' playing layout also draws the frame). */
    function applyModeClasses() {
        if (!document.body) { return; }
        /* Both classes drive shared CSS (the tier frame + the diagonal tier-
           name ribbon). They're enabled whenever either card type is styled;
           the per-card `.rc-on` marker + card-type selectors do the real
           gating, so the performer playing-LAYOUT still only hits performer
           cards (which are only marked when performers are on). */
        var any = getSceneOn() || getPerfOn();
        document.body.classList.toggle("refract-cards-playing", any);
        document.body.classList.toggle("refract-cards-tiers", any);
        /* Lite mode is a CSS layer (04_lite.css) keyed off this class; it
           also gates the JS tilt (cardTiltBind) and hearts. */
        document.body.classList.toggle("refract-lite", getLiteOn());
    }
    applyModeClasses();

    /* Per-card scope marker. The CSS only styles cards carrying `.rc-on`, and
       a card only gets it when its type's toggle is on — so turning a group
       off restores the default Stash card (and bare `.card` panels like
       settings/modals never get styled). */
    function applyCardScope() {
        function mark(sel, on) {
            var els = document.querySelectorAll(sel);
            for (var i = 0; i < els.length; i++) { els[i].classList.toggle("rc-on", on); }
        }
        mark(".scene-card", getSceneOn());
        mark(".performer-card", getPerfOn());
        mark(OTHER_CARD_SELECTOR, getOtherOn());
    }

    /* Consulted by the extracted applyCardTier + tagFilledRatings. Scenes get
       the tier frame when scenes are on; performers when performers are on
       (their playing layout includes the frame). Other card types never tier. */
    function cardTierEnabled(card) {
        if (!card) { return false; }
        if (card.classList.contains("scene-card")) { return getSceneOn(); }
        if (card.classList.contains("performer-card")) { return getPerfOn(); }
        return false;
    }

    /* ═══ Extracted from Refract refract.js — constants ═══ */

    var GRAPHQL_URL = "/graphql";

    var STORAGE_KEY_API = "refract.apiKey";

    var RATING_SYSTEM_STORAGE_KEY = "refract.ratingSystemType";

    var TILT_MAX = 12;

    var TILT_SCALE = 1.04;

    var TILT_PERSPECTIVE = 800;

    var TILT_RESET_MS = 400;

    var TILT_MAX_GLARE = 0.18;

    var TILT_EASING = "cubic-bezier(.03,.98,.52,.99)";

    var MAX_PERFORMER_CIRCLES = 5;

    var FILE_EXT_RE = /\.(mp4|m4v|mkv|mov|avi|webm|wmv|flv|ts|m2ts|mpg|mpeg|3gp|f4v|ogv|asf)$/i;

    var TAG_ICON_SVG =
        '<svg class="stash-tag-icon" viewBox="0 0 512 512" aria-hidden="true">' +
        '<path fill="currentColor" d="M32.5 96l0 149.5c0 17 6.7 33.3 18.7 45.3l192 192c25 25 65.5 25 90.5 0L483.2 333.3c25-25 25-65.5 0-90.5l-192-192C279.2 38.7 263 32 246 32L96.5 32c-35.3 0-64 28.7-64 64zm112 16a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/>' +
        '</svg>';

    var O_ICON_SVG =
        '<svg viewBox="0 0 36 36" fill="currentColor" aria-hidden="true">' +
        '<path d="M22.855.758L7.875 7.024l12.537 9.733c2.633 2.224 6.377 2.937 9.77 1.518c4.826-2.018 7.096-7.576 5.072-12.413C33.232 1.024 27.68-1.261 22.855.758zm-9.962 17.924L2.05 10.284L.137 23.529a7.993 7.993 0 0 0 2.958 7.803a8.001 8.001 0 0 0 9.798-12.65zm15.339 7.015l-8.156-4.69l-.033 9.223c-.088 2 .904 3.98 2.75 5.041a5.462 5.462 0 0 0 7.479-2.051c1.499-2.644.589-6.013-2.04-7.523z"/>' +
        '</svg>';

    var PEOPLE_ICON_SVG =
        '<svg class="stash-performer-icon" viewBox="0 0 640 512" aria-hidden="true">' +
        '<path fill="currentColor" d="M96 128a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zm0 192l192 0c53 0 96 43 96 96l0 32-384 0 0-32c0-53 43-96 96-96zm288-96a80 80 0 1 1 0-160 80 80 0 1 1 0 160zM496 416l0-32c0-44.2-25-83.3-62.9-103.7C440.7 277.3 449 276 457.5 276l13 0c66.3 0 120 53.7 120 120l0 20c0 22.1-17.9 40-40 40l-94.5 0c6.4-7.5 10.3-17.1 10.3-27.7l0-12.3z"/>' +
        '</svg>';

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

    var ASCENSION_FLAME_SVG =
        '<svg class="refract-ascension-icon" viewBox="0 0 512 512" aria-hidden="true">' +
        '<defs><linearGradient id="refract-flame-grad" x1="0.5" y1="0" x2="0.5" y2="1">' +
        '<stop offset="0" stop-color="#ffd24a"/>' +
        '<stop offset="0.5" stop-color="#ff7a18"/>' +
        '<stop offset="1" stop-color="#e11d2a"/>' +
        '</linearGradient></defs>' +
        '<path fill="url(#refract-flame-grad)" d="M160.53 20.906c-22.075.207-39.973 9.138-54.218 23.782C89.507 61.962 78.3 87.6 ' +
        '74.876 115.624c-6.847 56.05 16.55 119.953 82.094 146.625l-7.032 17.313c-64.128-26.096-93.275' +
        '-84.757-94.782-141-17.36 10.866-27.608 27.05-32.343 46.437-5.728 23.448-2.727 51.54 7.906 ' +
        '77.844 21.264 52.61 71.37 96.856 138.436 87.594l2.563 18.53c-48.795 6.74-90.183-11.576-119.907' +
        '-41.03-8.152 16.216-7.504 32.264-.657 48.312 8.472 19.854 27.498 39.252 52.875 53.594 47.085 ' +
        '26.61 114.8 35.554 173.19 5.094-5.43-20.99-2.652-45.074 11.342-69.313 22.71-39.332 60.78-49.83 ' +
        '88.375-38.688 13.798 5.572 25.08 16.555 29.875 31.157 4.796 14.6 2.836 32.303-7.375 50.312-11.8 ' +
        '20.81-34.144 27.877-51.25 22.22-8.552-2.83-16.22-9.437-18.875-18.876-2.653-9.44-.142-20.366 ' +
        '7.063-31.313l15.594 10.282c-5.238 7.955-5.5 13.08-4.69 15.967.813 2.888 2.84 4.895 6.75 6.188 ' +
        '7.822 2.587 21.483-.152 29.158-13.688 8.188-14.44 8.82-26.183 5.843-35.25-2.976-9.066-9.846' +
        '-15.954-19.092-19.687-18.493-7.467-46.14-2.273-65.188 30.72-14.024 24.29-14.373 45.376-6.72 ' +
        '63.436l2.814 4.375c-.197.13-.397.25-.594.376.256.497.513 1.008.78 1.5 1.945 3.565 4.218 7.007 ' +
        '6.814 10.28.1.13.21.25.312.377.395.49.81.984 1.22 1.468 11.508 13.657 28.358 24.378 47.312 ' +
        '30.283 24.26 7.557 51.596 7.146 74.843-3.75 23.248-10.897 42.935-31.972 52.69-68.375 3.323' +
        '-12.406 5.08-23.776 5.5-34.313.01-.418.023-.832.03-1.25.087-5.1-.088-10.246-.563-15.406-.037' +
        '-.407-.084-.814-.125-1.22-.032-.27-.06-.544-.093-.813-3.295-25.79-15.823-46.16-34.345-64.437' +
        '-29.635-29.24-75.698-51.638-122.75-74.125-47.052-22.487-95.112-45.1-128.875-77.656-31.683' +
        '-30.553-49.926-71.185-40.313-124.814-.72-.01-1.444-.006-2.156 0z"/></svg>';


    /* ═══ Extracted from Refract refract.js — functions ═══ */

    function gqlHeaders() {
        var h = { "Content-Type": "application/json" };
        try {
            var key = localStorage.getItem(STORAGE_KEY_API);
            if (key) { h.ApiKey = key; }
        } catch (e) { /* ignore */ }
        return h;
    }

    function gqlXhr(body) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", GRAPHQL_URL, true);
            xhr.withCredentials = true;
            var headers = gqlHeaders();
            Object.keys(headers).forEach(function (k) {
                xhr.setRequestHeader(k, headers[k]);
            });
            xhr.onload = function () {
                var res;
                try { res = JSON.parse(xhr.responseText); }
                catch (e) { reject(e); return; }
                /* onload fires for HTTP 4xx/5xx too (only transport
                   failures hit onerror). Without this guard an auth error
                   (401/403/422) with a parseable JSON body resolves with
                   res.data === undefined, which callers can't distinguish
                   from a legitimately empty result — so enrichment silently
                   no-ops with no retry signal. */
                if (xhr.status < 200 || xhr.status >= 300) {
                    var httpMsg = (res && res.errors && res.errors.length &&
                        res.errors[0].message) || ("HTTP " + xhr.status);
                    reject(new Error(httpMsg));
                    return;
                }
                /* GraphQL total failure: errors present AND no data at all.
                   Partial success (some aliased findScene calls resolved,
                   others errored — see initSceneCards) still carries `data`,
                   so we resolve and let the caller use what it got. */
                if (res && res.errors && res.errors.length && res.data == null) {
                    reject(new Error(res.errors[0].message || "GraphQL error"));
                    return;
                }
                resolve(res);
            };
            xhr.onerror = function () { reject(new Error("network error")); };
            xhr.send(body);
        });
    }

    function gql(query) {
        return gqlXhr(JSON.stringify({ query: query }));
    }

    function gqlWithVars(query, variables) {
        return gqlXhr(JSON.stringify({ query: query, variables: variables }));
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function nextTick(fn) {
        if (typeof queueMicrotask === "function") { queueMicrotask(fn); } else { setTimeout(fn, 0); }
    }

    function safeRun(fn) {
        try { fn(); } catch (e) { /* swallow — Stash re-renders will trigger another cycle */ }
    }

    function applyRatingSystemClass(type) {
        if (!document.body) { return; }
        document.body.classList.toggle("refract-cards-rating-stars",
            typeof type === "string" && type.toLowerCase() === "stars");
    }

    function refractFetchRatingSystem() {
        try {
            var cached = localStorage.getItem(RATING_SYSTEM_STORAGE_KEY);
            if (cached) { applyRatingSystemClass(cached); }
        } catch (e) { /* ignore */ }
        /* `configuration.ui` is a Map! scalar in Stash's GraphQL schema —
           you can't subselect fields on it. Query the whole blob and
           read ratingSystemOptions.type from the deserialised object.

           If `ratingSystemOptions.type` is missing (Stash's default,
           decimal mode, doesn't always serialise the field), treat as
           non-stars and clear the cached value — otherwise a previous
           "stars" cache would stick across a switch to decimal. */
        gql("query { configuration { ui } }")
            .then(function (res) {
                var ui = res && res.data && res.data.configuration
                    && res.data.configuration.ui;
                /* No usable config blob in a *successful* response — don't
                   clobber the cached value with "". (An errored/auth-failed
                   response now rejects in gqlXhr and lands in .catch below,
                   so it never reaches here and the cache is preserved.)
                   When ui IS present, an empty type legitimately means
                   decimal mode, so writing "" is correct. */
                if (!ui) { return; }
                var t = (ui.ratingSystemOptions && ui.ratingSystemOptions.type) || "";
                try { localStorage.setItem(RATING_SYSTEM_STORAGE_KEY, t); } catch (e) { /* ignore */ }
                applyRatingSystemClass(t);
            }).catch(function () { /* ignore — keep cached value */ });
    }

    function cardTiltBind(card) {
        if (card._stashTilt) { return; }
        /* Lite mode: skip the 3D-tilt + glare entirely. */
        if (document.body.classList.contains("refract-lite")) { return; }
        /* Home-page slick carousel cards: skip the tilt entirely. The per-
           mousemove perspective/scale transform forced backdrop-filter +
           glow-shadow re-raster every frame against a blur-dense home page,
           dropping hover to ~2fps on Chrome. CSS in 03_cards.css also
           flattens their :hover (no scale/glow). The effect stays on the
           real list/grid views. Not marked _stashTilt — the closest() check
           is cheap and keeps SPA re-binds correct. */
        if (card.closest && card.closest(".slick-slider")) { return; }
        card._stashTilt = true;

        /* Skip the glare overlay on image-cards — it paints above Stash's
           native hover lightbox-trigger icon and hides it from view. */
        var withGlare = !card.classList.contains("image-card");
        var glareInner = null;
        if (withGlare) {
            var glareWrap = document.createElement("div");
            glareWrap.className = "stash-tilt-glare";
            glareInner = document.createElement("div");
            glareInner.className = "stash-tilt-glare-inner";
            glareWrap.appendChild(glareInner);
            card.appendChild(glareWrap);
        }

        var raf = null;

        function applyTilt(e) {
            var rect = card.getBoundingClientRect();
            var x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            var y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
            var tiltX = ((0.5 - x) * TILT_MAX).toFixed(2);
            var tiltY = ((y - 0.5) * TILT_MAX).toFixed(2);
            var angle = Math.atan2(x - 0.5, y - 0.5) * (180 / Math.PI);
            card.style.transform =
                "perspective(" + TILT_PERSPECTIVE + "px) " +
                "rotateX(" + tiltY + "deg) rotateY(" + tiltX + "deg) " +
                "scale3d(" + TILT_SCALE + "," + TILT_SCALE + "," + TILT_SCALE + ")";
            if (glareInner) {
                glareInner.style.transform = "rotate(" + angle + "deg) translate(-50%, -50%)";
                glareInner.style.opacity = String(((x + y) / 2) * TILT_MAX_GLARE);
            }
        }

        var enterTimer = null;
        function onEnter() {
            /* Cancel any pending leave-cleanup so the timer doesn't strip
               the transform we're about to set. */
            if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
            card.style.willChange = "transform";
            card.style.transition = "transform 0.22s " + TILT_EASING;
            card.style.zIndex = "1000";
            card.style.transform =
                "perspective(" + TILT_PERSPECTIVE + "px) rotateX(0deg) rotateY(0deg) " +
                "scale3d(" + TILT_SCALE + "," + TILT_SCALE + "," + TILT_SCALE + ")";
            if (enterTimer) { clearTimeout(enterTimer); }
            enterTimer = setTimeout(function () {
                if (card.style.zIndex === "1000") {
                    card.style.transition = "none";
                }
                enterTimer = null;
            }, 220);
        }

        function onMove(e) {
            if (raf) { cancelAnimationFrame(raf); }
            raf = requestAnimationFrame(function () { applyTilt(e); });
        }

        var leaveTimer = null;
        function onLeave() {
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            if (enterTimer) { clearTimeout(enterTimer); enterTimer = null; }
            card.style.willChange = "auto";
            card.style.zIndex = "";
            card.style.transition = "transform " + TILT_RESET_MS + "ms " + TILT_EASING + ", box-shadow 0.22s ease";
            card.style.transform =
                "perspective(" + TILT_PERSPECTIVE + "px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
            /* After the reset transition finishes, drop the inline
               transform entirely so the card stops holding a permanent
               GPU compositor layer. The string check guards against
               clobbering a fresh hover that started within the reset
               window (onEnter cancels this timer in that case anyway). */
            if (leaveTimer) { clearTimeout(leaveTimer); }
            leaveTimer = setTimeout(function () {
                if (card.style.transform.indexOf("scale3d(1, 1, 1)") !== -1
                    || card.style.transform.indexOf("scale3d(1,1,1)") !== -1) {
                    card.style.removeProperty("transform");
                    card.style.removeProperty("transition");
                }
                leaveTimer = null;
            }, TILT_RESET_MS + 50);
            card.style.removeProperty("animation");
            if (glareInner) { glareInner.style.opacity = "0"; }
        }

        card.addEventListener("mouseenter", onEnter);
        card.addEventListener("mousemove", onMove);
        card.addEventListener("mouseleave", onLeave);
    }

    function initCardTilts() {
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { return; }
        /* Bind tilt listeners + glare overlay up front at boot / SPA-rebind.
           v1.13.13 lazy-bound these via IntersectionObserver (bind only when a
           card neared the viewport) to shave boot cost ~80→~20 cards, but that
           appended the .stash-tilt-glare overlay div mid-scroll as cards came
           into view — a DOM mutation during scroll that flashed a visible
           pop-in (worst on Firefox during fast scroll). Binding all present
           cards directly costs only a few listeners + one tiny div each, and
           the _stashTilt idempotence guard in cardTiltBind keeps repeat
           (SPA-rebind) calls cheap. */
        document.querySelectorAll(".rc-on").forEach(function (card) {
            cardTiltBind(card);
        });
    }

    function extractSceneId(card) {
        var a = card.querySelector('a[href^="/scenes/"]');
        if (!a) { return null; }
        var m = (a.getAttribute("href") || "").match(/\/scenes\/(\d+)/);
        return m ? parseInt(m[1], 10) : null;
    }

    function stopProp(e) { e.stopPropagation(); }

    function tagOrientation(card) {
        if (card.classList.contains("refract-portrait") ||
            card.classList.contains("refract-landscape-checked")) { return; }
        var media = card.querySelector(".scene-card-preview img, .scene-card-preview video, .scene-card-preview .preview-image");
        if (!media) { return; }
        var check = function () {
            var w = media.naturalWidth || media.videoWidth || 0;
            var h = media.naturalHeight || media.videoHeight || 0;
            if (!w || !h) { return; }
            if (h > w) { card.classList.add("refract-portrait"); }
            else { card.classList.add("refract-landscape-checked"); }
        };
        if (media.complete && media.naturalWidth) { check(); }
        else { media.addEventListener("load", check, { once: true }); }
    }

    function stripTitleExt(el) {
        if (!el) { return; }
        var text = (el.textContent || "").trim();
        if (!FILE_EXT_RE.test(text)) { return; }
        el.textContent = text.replace(FILE_EXT_RE, "");
    }

    function stripSceneFileExtensions() {
        document.querySelectorAll(".scene-card .card-section-title").forEach(stripTitleExt);
    }

    function injectPerformerCircles(card, performers, tagCount, sceneId, oCount, tagInfo) {
        if (card.querySelector(".stash-performer-circles")) { return; }
        var section = card.querySelector(".card-section");
        if (!section) { return; }

        /* Strip the file-extension from the title at the per-card stable
           point (after GQL data has hydrated). Faster + more reliable
           than waiting for the body mutation watcher to find it. */
        stripTitleExt(card.querySelector(".card-section-title"));

        var row = document.createElement("div");
        row.className = "stash-performer-circles";

        var avatarWrap = document.createElement("div");
        avatarWrap.className = "stash-performer-avatars";

        var shown = performers.slice(0, MAX_PERFORMER_CIRCLES);
        var extra = performers.length - shown.length;

        shown.forEach(function (p) {
            var link = document.createElement("a");
            link.className = "stash-performer-link";
            link.href = "/performers/" + p.id;
            link.addEventListener("click", stopProp);
            if (p.name) {
                link.setAttribute("aria-label", p.name);
                link.dataset.performerName = p.name;
            }

            var img = document.createElement("img");
            img.className = "stash-performer-avatar";
            img.src = "/performer/" + p.id + "/image";
            img.alt = p.name || "";
            img.loading = "lazy";
            link.appendChild(img);
            avatarWrap.appendChild(link);
        });

        if (extra > 0) {
            var more = document.createElement("span");
            more.className = "stash-performer-more";
            more.textContent = "+" + extra;
            avatarWrap.appendChild(more);
        }

        row.appendChild(avatarWrap);

        /* Right-side count cluster — holds duration / O count / tag count
           badges so they share consistent spacing when present. */
        var counts = document.createElement("div");
        counts.className = "stash-card-counts";

        /* Duration pill — mirrors Stash's native .overlay-duration text
           into the counts cluster. In minimal mode this is the leftmost
           pill in the right cluster (replacing the performer pill); the
           original .overlay-duration on the thumbnail is hidden via CSS.
           In other modes the pill is hidden via CSS and the native
           overlay-duration stays in its usual spot. */
        var durEl = card.querySelector(".overlay-duration");
        var durText = durEl ? (durEl.textContent || "").trim() : "";
        if (durText) {
            var dPill = document.createElement("span");
            dPill.className = "stash-duration-pill";
            dPill.textContent = durText;
            counts.appendChild(dPill);
        }

        /* Performer pill — alternative compact representation that lives
           ALONGSIDE the avatar circles. CSS gates which one is visible:
           default mode shows circles, minimal mode shows the pill.
           Pill markup mirrors .stash-tag-count: clickable anchor to the
           first performer + glass popup (.stash-performer-popup) with
           every performer's avatar + name. */
        if (performers && performers.length) {
            var pillHref = "/performers/" + performers[0].id;
            var pPill = document.createElement("a");
            pPill.className = "stash-performer-pill";
            pPill.href = pillHref;
            pPill.title = performers.length + " performer" + (performers.length === 1 ? "" : "s");
            pPill.addEventListener("click", stopProp);
            pPill.innerHTML = PEOPLE_ICON_SVG + "<span>" + performers.length + "</span>";

            var pPop = document.createElement("div");
            pPop.className = "stash-performer-popup";
            performers.forEach(function (p) {
                if (!p || !p.id) { return; }
                var chip = document.createElement("a");
                chip.className = "stash-performer-popup-chip";
                chip.href = "/performers/" + p.id;
                chip.addEventListener("click", stopProp);
                var ava = document.createElement("img");
                ava.className = "stash-performer-popup-avatar";
                ava.src = "/performer/" + p.id + "/image";
                ava.alt = p.name || "";
                ava.loading = "lazy";
                chip.appendChild(ava);
                var nameSpan = document.createElement("span");
                nameSpan.className = "stash-performer-popup-name";
                nameSpan.textContent = p.name || "(unknown)";
                chip.appendChild(nameSpan);
                pPop.appendChild(chip);
            });
            pPill.appendChild(pPop);
            counts.appendChild(pPill);
        }

        if (oCount && oCount > 0) {
            var oBadge = document.createElement("span");
            oBadge.className = "stash-o-count";
            oBadge.title = oCount + " O";
            oBadge.innerHTML = O_ICON_SVG + "<span>" + oCount + "</span>";
            counts.appendChild(oBadge);
        }

        if (tagCount > 0) {
            var badge = document.createElement("a");
            badge.className = "stash-tag-count";
            badge.href = sceneId ? "/scenes/" + sceneId : "/tags";
            badge.addEventListener("click", stopProp);
            badge.innerHTML = TAG_ICON_SVG + "<span>" + tagCount + "</span>";
            /* Hover popup — clickable tag chips, each linking to /tags/:id.
               Built as a sibling-anchored sibling node (not via attr()) so
               we can attach event handlers and per-chip hover states. */
            if (tagInfo && tagInfo.length) {
                var popup = document.createElement("div");
                popup.className = "stash-tag-popup";
                tagInfo.forEach(function (t) {
                    var chip = document.createElement("a");
                    chip.className = "stash-tag-popup-chip";
                    chip.href = "/tags/" + t.id;
                    chip.textContent = t.name;
                    chip.addEventListener("click", stopProp);
                    popup.appendChild(chip);
                });
                badge.appendChild(popup);
            }
            counts.appendChild(badge);
        }

        if (counts.firstChild) {
            row.appendChild(counts);
        }

        section.appendChild(row);

        /* Tag portrait thumbnails so the minimal-mode cover-fill CSS can
           opt them out — for vertical scenes the cover behaviour would
           crop heavily. The image often isn't loaded yet, so check
           complete + naturalWidth, else listen for load once. */
        tagOrientation(card);

        /* Floating-hearts effect for "Favourite" scenes — driven by the
           "Favourite ★" tag injected by the Advanced Rating plugin. We
           detect via the tagInfo array (case-insensitive match on
           "favourite" / "favorite" so it works for either spelling and
           catches the ★-suffix). Class + 7-heart layer are toggled in
           sync; only tagged cards pay the animation cost. */
        var isFavourite = tagInfo && tagInfo.some(function (t) {
            return t && t.name && /^favou?rite/i.test(t.name);
        });
        var existingHearts = card.querySelector(":scope > .refract-heart-particles");
        if (isFavourite) {
            card.classList.add("refract-favourite");
            if (!existingHearts) {
                var particles = document.createElement("div");
                particles.className = "refract-heart-particles";
                particles.setAttribute("aria-hidden", "true");
                for (var hi = 1; hi <= 5; hi++) {
                    var heart = document.createElement("span");
                    heart.className = "refract-heart refract-heart-" + hi;
                    heart.textContent = "♥"; /* ♥ */
                    particles.appendChild(heart);
                }
                card.appendChild(particles);
            }
        } else {
            card.classList.remove("refract-favourite");
            if (existingHearts) { existingHearts.remove(); }
        }
    }

    function injectSceneRating(card, rating100) {
        if (!card || !rating100 || rating100 <= 0) { return; }
        var v10 = rating100 / 10;
        var starsMode = document.body.classList.contains("refract-cards-rating-stars");
        var displayValue;
        if (starsMode) {
            /* 0-5 scale, trimmed to 2 decimals to dodge float artifacts
               like 3.7500000001; trailing zeros stripped via String. */
            displayValue = String(Math.round((v10 / 2) * 100) / 100);
        } else {
            displayValue = v10.toFixed(1);
        }
        var banner = card.querySelector(":scope > .rating-banner");
        if (!banner) {
            banner = document.createElement("div");
            banner.className = "rating-banner";
            card.appendChild(banner);
        }
        banner.textContent = displayValue;
    }

    function initSceneCards() {
        var cards = document.querySelectorAll(".scene-card:not([data-stash-sc])");
        if (!cards.length) { return; }

        var ids = [];
        var cardMap = {};
        cards.forEach(function (card) {
            var id = extractSceneId(card);
            if (id !== null) {
                card.setAttribute("data-stash-sc", "1");
                /* Tier label placeholder — empty <div> always present;
                   CSS reads the card's `refract-card-tier-*` class (set
                   by tagFilledRatings) and fills the visible text via
                   `::after { content: "BRONZE"/...PERFECT }`. Hidden in
                   non-playing-card modes via the default reset block in
                   16_playing_card.css. */
                if (!card.querySelector(":scope > .refract-pc-tier-label")) {
                    var tierLabel = document.createElement("div");
                    tierLabel.className = "refract-pc-tier-label";
                    card.appendChild(tierLabel);
                }
                ids.push(id);
                cardMap[id] = card;         /* int key */
                cardMap[String(id)] = card; /* string key — GQL returns id as string */
            }
        });

        if (!ids.length) { return; }

        /* Use aliased findScene (singular) calls instead of findScenes
           (plural) with scene_ids. Stash's findScenes(scene_ids:) errors
           the entire batch if ANY id in the list doesn't exist — and on
           a home page with stale/deleted recommendations that's common
           enough to silently break every card in the page. findScene(id:)
           returns null for missing ids, so other aliases in the same
           query still resolve and the rest of the cards get badges. */
        var fields = 'id o_counter rating100 performers { id name } tags { id name }';
        var aliases = ids.map(function (id) {
            return 's' + id + ': findScene(id: ' + id + ') { ' + fields + ' }';
        }).join(' ');
        var q = 'query { ' + aliases + ' }';
        gql(q)
            .then(function (res) {
                var data = res.data || {};
                Object.keys(data).forEach(function (key) {
                    var scene = data[key];
                    if (!scene) { return; }
                    var tags = scene.tags || [];
                    var tagInfo = tags.map(function (t) { return { id: t.id, name: t.name }; })
                                      .filter(function (t) { return t.id && t.name; });
                    var oCount = parseInt(scene.o_counter, 10) || 0;
                    var rating = parseInt(scene.rating100, 10) || 0;
                    /* Re-query the live DOM by scene-id href instead of
                       trusting cardMap. On the home page, React + slick
                       reshuffle/clone scene-card nodes between when we
                       fire the query and when it resolves — cardMap
                       refs point to detached originals while the visible
                       cards (including slick clones) are new nodes that
                       cardMap doesn't know about. Querying by href
                       finds whatever's in the DOM right now, so all
                       visible copies of a scene-card get badges. The
                       idempotence checks inside injectPerformerCircles
                       /injectSceneRating make double-calls safe. */
                    var sceneId = String(scene.id);
                    var liveCards = document.querySelectorAll(
                        '.scene-card a[href^="/scenes/' + sceneId + '?"], ' +
                        '.scene-card a[href="/scenes/' + sceneId + '"], ' +
                        '.scene-card a[href^="/scenes/' + sceneId + '/"]'
                    );
                    var seen = [];
                    liveCards.forEach(function (a) {
                        var card = a.closest(".scene-card");
                        if (!card || seen.indexOf(card) !== -1) { return; }
                        seen.push(card);
                        injectPerformerCircles(card, scene.performers || [], tags.length, scene.id, oCount, tagInfo);
                        injectSceneRating(card, rating);
                    });
                });
                /* Re-tag freshly-injected banners so tier classes + the
                   --refract-rating var land for intensity/tiers modes. */
                try { tagFilledRatings(); } catch (e) { /* ignore */ }
            })
            .catch(function () {
                /* Query failed (expired ApiKey, network blip, Stash
                   restart). Un-mark the cards we claimed so the next
                   MutationObserver pass retries them — otherwise
                   :not([data-stash-sc]) excludes them forever and they show
                   no badges until a full reload. Re-query live by href since
                   React may have swapped the nodes while in flight; a
                   detached original still carrying the marker is harmless
                   (the live selector never sees it). */
                ids.forEach(function (id) {
                    document.querySelectorAll(
                        '.scene-card[data-stash-sc] a[href^="/scenes/' + id + '?"], ' +
                        '.scene-card[data-stash-sc] a[href="/scenes/' + id + '"], ' +
                        '.scene-card[data-stash-sc] a[href^="/scenes/' + id + '/"]'
                    ).forEach(function (a) {
                        var c = a.closest(".scene-card");
                        if (c) { c.removeAttribute("data-stash-sc"); }
                    });
                });
            });
    }

    function applyCardTier(card, v) {
        if (!card) { return; }
        ["bronze", "silver", "gold", "diamond", "legendary", "perfect"].forEach(function (t) {
            card.classList.remove("refract-card-tier-" + t);
        });
        if (cardTierEnabled(card) && v >= 5) {
            var tier = v >= 10  ? "perfect"
                     : v >= 9.5 ? "legendary"
                     : v >= 8.5 ? "diamond"
                     : v >= 7.5 ? "gold"
                     : v >= 6.5 ? "silver"
                     :            "bronze";
            card.classList.add("refract-card-tier-" + tier);
        }
    }

    function initPerformerCards() {
        if (!getPerfOn()) { return; }
        document.querySelectorAll(".performer-card:not([data-stash-pc])").forEach(function (card) {
            card.setAttribute("data-stash-pc", "1");

            var section  = card.querySelector(".card-section");
            var ageEl    = card.querySelector(".performer-card__age");
            var sceneLink = card.querySelector(".card-popovers .scene-count");
            var hr       = card.querySelector("hr");
            var popovers = card.querySelector(".card-popovers");
            var titleEl = card.querySelector(".card-section-title");
            /* Stash renders the country flag with class
               `performer-card__country-flag fi fi-XX` (flag-icons CSS
               library: `fi` = base, `fi-XX` = country code). Older
               Stash builds used `.flag-icon`; keep that as a fallback
               so the plugin still surfaces a flag in either layout. */
            var flagEl   = card.querySelector(".performer-card__country-flag, .flag-icon");
            var ratingEl = card.querySelector(".rating-banner");
            if (!section) { return; }

            var row = document.createElement("div");
            row.className = "stash-perf-stats";

            /* Rating badge — gated to playing-card mode via CSS. We always
               inject the badge if the card has a rated banner; the number
               comes from the same parse path as tagFilledRatings (className
               > textContent). Only injected when v > 0. */
            if (ratingEl) {
                var ratingNum = null;
                var mCls = ratingEl.className.match(/\brating-100-(\d+)\b/);
                if (mCls) {
                    ratingNum = parseInt(mCls[1], 10) * 5 / 10;
                } else {
                    mCls = ratingEl.className.match(/\brating-(\d+)\b/);
                    if (mCls) { ratingNum = parseInt(mCls[1], 10) * 2; }
                }
                if (ratingNum == null) {
                    var raw = (ratingEl.textContent || "").trim();
                    var rawV = parseFloat(raw);
                    if (isFinite(rawV) && rawV > 0) {
                        ratingNum = rawV <= 5 ? rawV * 2 : rawV;
                    }
                }
                if (ratingNum && ratingNum > 0) {
                    /* Tier the card now, from the banner we just read —
                       before Ascension can delete it (see applyCardTier). */
                    applyCardTier(card, ratingNum);
                    /* If the user has Stash's rating system set to stars,
                       show the rating chip on a 0–5 scale to match their
                       configured UI; otherwise stay on the 0–10 decimal
                       scale. Detection: `body.refract-cards-rating-stars`
                       is set by refractFetchRatingSystem() on init.
                       The internal `ratingNum` stays 0–10 so tier
                       classification (Bronze..Perfect) still works the
                       same. Math.round to 2 decimals to avoid floating-
                       point artefacts like "3.7500000000001". */
                    var displayRating = ratingNum;
                    var starsMode = document.body.classList.contains("refract-cards-rating-stars");
                    if (starsMode) {
                        displayRating = Math.round((ratingNum / 2) * 100) / 100;
                    }
                    var rEl = document.createElement("span");
                    rEl.className = "stash-perf-rating";
                    rEl.title = "Rating " + displayRating + (starsMode ? " / 5" : " / 10");
                    rEl.innerHTML = STAR_SVG +
                        '<span class="stash-perf-label">Rating</span>' +
                        "<span>" + escapeHtml(String(displayRating)) + "</span>";
                    row.appendChild(rEl);
                }
            }

            /* Age — adds a cake icon + "Age" label so the bare number
               (e.g. "27") isn't ambiguous in the playing-card stats
               strip. The icon and label are CSS-hidden in Minimal /
               Extravagant modes so those modes keep the compact
               icon-less "27" rendering they had before. */
            if (ageEl) {
                var ageText = ageEl.textContent.replace(/\s*years?\s+old/gi, "").trim();
                /* Stash appends " at production" when the scene has a
                   date and the performer's age is being shown relative
                   to that date. Move the qualifier into the chip label
                   so the value stays a clean bare number. */
                var ageAtProduction = /\s*at\s+production\s*$/i.test(ageText);
                if (ageAtProduction) {
                    ageText = ageText.replace(/\s*at\s+production\s*$/i, "").trim();
                }
                if (ageText) {
                    var ageSpan = document.createElement("span");
                    ageSpan.className = "stash-perf-age";
                    if (ageAtProduction) {
                        ageSpan.title = "Age at production";
                    }
                    ageSpan.innerHTML = CAKE_SVG +
                        '<span class="stash-perf-label">Age' +
                            (ageAtProduction ? '<span class="stash-perf-label-mark">*</span>' : '') +
                        '</span>' +
                        "<span>" + escapeHtml(ageText) + "</span>";
                    row.appendChild(ageSpan);
                }
                ageEl.style.display = "none";
            }

            /* O count — Stash renders it as a two-button group:
                 .count-button > [button title="O Count"] + [button.count-value > span]
               Find the title="O Count" button, walk to its parent group,
               read the .count-value span. Only inject when non-zero. */
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

            /* Scene count — wrap the number in an inner <span> for the
               same reason as age (lets playing-card mode target an inner
               element for gradient text-clip without clipping the chip). */
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

            /* Country flag — kept around; clone is injected INSIDE the
               name banner (alongside the gender icon) in playing-card
               mode. This frees the top-right corner for the diagonal
               tier banner. The flag clone is added below when we
               build the name banner. */

            /* Tier label placeholder — empty in DOM. In playing-card
               mode, CSS reads the card's `refract-card-tier-*` class
               (applied later by tagFilledRatings) and fills this
               element via `::after { content: ... }`. Always injected
               so we don't need to re-run initPerformerCards when the
               rating changes; CSS handles visibility per tier. */
            var tierLabel = document.createElement("div");
            tierLabel.className = "refract-pc-tier-label";
            card.appendChild(tierLabel);

            section.appendChild(row);

            /* Combined shrink-to-fit for the stat strip + name banner.
               Both passes need to re-run on card resize (window zoom,
               grid reflow, etc.) — the one-shot rAF that fired only on
               first inject left the badges cut off after `cmd+`/`cmd-`.
               `var bannerInner` is hoisted to the forEach scope and is
               assigned later in the if(titleEl) block — by the time
               refit() actually runs (rAF / ResizeObserver callback),
               that assignment has happened or `bannerInner` is
               undefined and we skip the name pass. */
            var refitPending = false;
            function refit() {
                if (refitPending) { return; }
                refitPending = true;
                requestAnimationFrame(function () {
                    refitPending = false;
                    if (!document.body.classList.contains("refract-cards-playing")) { return; }
                    /* Stat strip — high scene counts (3 digits) push
                       chips off the right edge. Step --pc-badge-scale
                       down through the ladder until the row fits. */
                    var scales = [1, 0.92, 0.84, 0.76, 0.68, 0.6];
                    for (var i = 0; i < scales.length; i++) {
                        row.style.setProperty("--pc-badge-scale", scales[i]);
                        if (row.scrollWidth <= row.clientWidth + 1) { break; }
                    }
                    /* Name banner — Concert One is moderately wide;
                       step font-size down through the ladder until the
                       text fits the left 3/4 of the banner. */
                    if (bannerInner) {
                        var sizes = [1.25, 1.1, 0.95, 0.85, 0.75, 0.7];
                        for (var j = 0; j < sizes.length; j++) {
                            bannerInner.style.fontSize = sizes[j] + "rem";
                            if (bannerInner.scrollWidth <= bannerInner.clientWidth + 1) { break; }
                        }
                    }
                });
            }

            /* Playing-card mode name banner — Pokemon-style header:
                 [gender icon (type)]  Name        ← left-aligned
               Inject a copy of the gender icon (cloned from native
               .gender-icon under the title) PLUS just the performer name
               text (from .TruncatedText so we exclude the hidden country
               string). Display is CSS-gated to playing-card mode. */
            /* Country indicator — extract the ISO-2 code from the
               flag-icons class (`fi fi-XX`) and convert it to the
               full localized country name via `Intl.DisplayNames`
               (built-in browser API). Inserted into the chin above
               the stat strip so it stacks naturally as a quiet
               caption (no absolute positioning to fight). Falls
               back to the raw uppercase code if DisplayNames isn't
               available or doesn't know the region. */
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
                    /* Name lives in an inner span so the Ascension rank
                       read-out can sit on the SAME line, pushed to the
                       right edge, while the name still ellipsis-truncates
                       if it's long (see integrateAscensionBadges). */
                    var countryNameSpan = document.createElement("span");
                    countryNameSpan.className = "stash-perf-country-name";
                    countryNameSpan.textContent = countryName;
                    countryWrap.appendChild(countryNameSpan);
                    section.insertBefore(countryWrap, row);
                }
            }

            if (titleEl) {
                var banner = document.createElement("div");
                banner.className = "refract-pc-name-banner";
                /* Gender — corner "type" slot before the name */
                var genderEl = titleEl.querySelector(".gender-icon");
                if (genderEl) {
                    banner.appendChild(genderEl.cloneNode(true));
                }
                /* Name — prefer .TruncatedText child; falls back to title
                   textContent. Avoid grabbing titleEl.textContent directly
                   since Stash also renders .performer-card__country-string
                   inside the title (display:none but textContent-visible).
                   We clone the element and strip any disambiguation
                   children before extracting textContent, otherwise the
                   parenthetical "(Tall)" disambig text would be folded
                   into the rendered name. */
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
                var bannerInner = document.createElement("span");
                bannerInner.className = "refract-pc-name-text";
                bannerInner.textContent = nameText;
                banner.appendChild(bannerInner);
                card.insertBefore(banner, card.firstChild);

            }

            /* Initial fit + ResizeObserver re-fit on any card size change
               (window zoom via cmd+/-, grid reflow on viewport resize,
               font-loading shift, etc.). Without this the badges got
               cut off after a zoom because the one-shot rAF that ran on
               first inject didn't re-measure. ResizeObserver is rAF-
               coalesced internally so multiple card resizes per frame
               collapse to one refit. */
            refit();
            if (window.ResizeObserver) {
                var ro = new ResizeObserver(refit);
                ro.observe(card);
            }

            if (hr) { hr.style.display = "none"; }
            if (popovers) { popovers.style.display = "none"; }
        });
    }

    function syncPerformerCardHearts() {
        /* Lite mode drops the floating hearts; the else-branch below then
           strips any hearts injected before lite was turned on. */
        var inPlayingCard = getPerfOn() && !getLiteOn();
        document.querySelectorAll(".performer-card").forEach(function (card) {
            var isFav = !!card.querySelector(".favorite-button.favorite");
            var existing = card.querySelector(":scope > .refract-heart-particles");
            if (inPlayingCard && isFav) {
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
        });
    }

    function integrateAscensionBadges() {
        var badges = document.querySelectorAll(".performer-card .hon-battle-rank-badge");
        if (badges.length) {
            document.body.classList.add("refract-has-ascension");
        }
        /* Only playing-card mode shows the `.stash-perf-country` caption;
           in other rating styles it's CSS-hidden, so nesting the rank
           into it would hide it too, so fall back to the chin there. */
        var pcMode = document.body.classList.contains("refract-cards-playing");
        badges.forEach(function (badge) {
            badge.classList.add("refract-ascension-badge");
            /* Ascension renders "undefinedW/L/D" when a performer has no
               recorded record yet, so sanitise so the line reads cleanly.
               Re-runs each cycle, so it self-heals if Ascension rebuilds
               the badge. */
            badge.querySelectorAll(".hon-wins, .hon-losses, .hon-draws").forEach(function (s) {
                if (/undefined/i.test(s.textContent)) {
                    s.textContent = s.textContent.replace(/undefined/gi, "0");
                }
            });
            /* Drop both the literal "Rank " word and the "#" so the
               read-out is a bare number after the flame glyph. Only write
               when it actually changes, to avoid needless mutations. */
            var rankText = badge.querySelector(".hon-rank-text");
            if (rankText) {
                var stripped = rankText.textContent
                    .replace(/^\s*rank\s*/i, "")
                    .replace(/^\s*#\s*/, "");
                if (stripped !== rankText.textContent) {
                    rankText.textContent = stripped;
                }
            }
            /* Lead the read-out with Ascension's own navbar flame glyph
               (once per badge instance). Sits before the plugin's tier
               emoji, which CSS hides, so the line reads "[flame] N". The
               glyph carries its own warm gradient fill, so no per-card
               colour wiring is needed. */
            if (!badge.querySelector(".refract-ascension-icon")) {
                badge.insertAdjacentHTML("afterbegin", ASCENSION_FLAME_SVG);
            }
            var card = badge.closest(".performer-card");
            if (!card) { return; }
            var section = card.querySelector(".card-section");
            /* Playing-card mode: ride the country caption's line, pushed to
               the RIGHT edge of the card. The marker class turns the caption
               into a space-between flex row (name left, rank right), and we
               append the badge as its last child. */
            var country = (pcMode && section)
                ? section.querySelector(":scope > .stash-perf-country")
                : null;
            if (country) {
                country.classList.add("refract-country-with-rank");
                if (badge.parentElement === country && country.lastElementChild === badge) {
                    return;
                }
                country.appendChild(badge);
                return;
            }
            /* Fallback (no country caption / non-playing-card): sit in the
               chin, just above the stat pills. */
            if (!section) { return; }
            var anchor = section.querySelector(":scope > .stash-perf-stats");
            if (anchor) {
                if (badge.parentElement === section && badge.nextElementSibling === anchor) {
                    return;
                }
                section.insertBefore(badge, anchor);
            } else if (!(badge.parentElement === section && badge === section.lastElementChild)) {
                section.appendChild(badge);
            }
        });
    }

    function tagFilledRatings() {
        document.querySelectorAll(".rating-number").forEach(function (el) {
            var span = el.querySelector(":scope > span");
            var text = span ? (span.textContent || "").trim() : "";
            var hasInput = !!el.querySelector(":scope > input");
            var v = parseFloat(text);
            var rated = !hasInput && isFinite(v) && v > 0;
            el.classList.toggle("refract-rated", rated);
        });
        /* Some plugins (e.g. stash-multiview, alternate-scale displays)
           inject a SECOND `.rating-banner` element on the same card —
           often with a different value scale (5/5 stars rendered as a
           "10/10 decimal" equivalent). Iterating all banners would let
           the second banner overwrite the first's tier classes,
           promoting low-rated cards to Perfect. Track which cards
           have already been tier-classified and skip subsequent
           banners on the same card. The FIRST banner in DOM order is
           Stash's canonical overlay (inside the scene-card-link /
           performer-card image area), so we trust it. */
        var tieredCards = new WeakSet();
        document.querySelectorAll(".rating-banner").forEach(function (el) {
            var dupeCard = el.closest(".performer-card, .scene-card");
            if (dupeCard && tieredCards.has(dupeCard)) { return; }
            if (dupeCard) { tieredCards.add(dupeCard); }
            /* Read rating100 from the banner's className, not text — Stash's
               RatingBanner.tsx writes one of:
                 • `rating-100-N`   (N = trunc(rating100 / 5), 0–20)
                   used for decimal mode + 5-star half/quarter precision
                 • `rating-N`       (N = 1–5, legacy full-star precision)
               This works regardless of which rating system the user has
               configured and avoids depending on locale-formatted text. */
            var rating100 = null;
            var mCls = el.className.match(/\brating-100-(\d+)\b/);
            if (mCls) {
                /* Stash has shipped multiple `rating-100-N` formats:
                     • Old: N = floor(rating100/5), range 0-20
                     • New: N IS rating100 directly, range 0-100
                   Detect by magnitude — anything > 20 has to be the
                   new format (since the old format maxes at 20). */
                var n = parseInt(mCls[1], 10);
                rating100 = n > 20 ? Math.min(100, n) : n * 5;
            } else {
                mCls = el.className.match(/\brating-(\d+)\b/);
                if (mCls) { rating100 = Math.min(100, parseInt(mCls[1], 10) * 20); }
            }
            /* Fallback: parse the visible text in case Stash markup
               changes or a 3rd-party plugin injects a banner without
               the `rating-100-N` / `rating-N` class. Use the configured
               rating system (`body.refract-cards-rating-stars`, set
               by refractFetchRatingSystem) to pick the scale —
               otherwise a decimal-mode 5/10 would be parsed as 5/5
               (Perfect) and 4.9/10 as 4.9/5 (Legendary), since the
               old `rawV <= 5 ? * 20 : * 10` heuristic always assumed
               low values meant stars. Clamp to 100 so an out-of-range
               input can't promote to a higher tier.

               Special guard: values >5 can ONLY be decimal (stars max
               is 5), so always treat them as decimal (×10) regardless
               of the body class. This makes the parser resilient to a
               stale `refract-cards-rating-stars` class that might
               persist briefly after a stars→decimal switch. */
            if (rating100 === null) {
                var raw = (el.textContent || "").trim();
                var rawV = parseFloat(raw);
                if (isFinite(rawV) && rawV > 0) {
                    if (rawV > 5) {
                        rating100 = Math.min(100, rawV * 10);
                    } else {
                        var starsMode = document.body.classList.contains("refract-cards-rating-stars");
                        rating100 = Math.min(100, starsMode ? rawV * 20 : rawV * 10);
                    }
                }
            }
            /* Diagnostic logging — temporary. Enable by running
               `window._refractTierDebug = true` in DevTools, then
               reload. Logs one line per scene-card rating banner so
               we can see what classes + text it has + how the parser
               interpreted it. Remove once tier classification is
               confirmed correct. */
            if (window._refractTierDebug) {
                var dbgCard = el.closest(".scene-card");
                if (dbgCard) {
                    console.log("[refract tier]",
                        "class:", el.className,
                        "text:", JSON.stringify((el.textContent || "").trim()),
                        "rating100:", rating100,
                        "v:", rating100 == null ? null : rating100 / 10,
                        "starsBodyClass:", document.body.classList.contains("refract-cards-rating-stars")
                    );
                }
            }
            var v = rating100 == null ? 0 : rating100 / 10; /* 0–10 normalized */

            ["refract-tier-low", "refract-tier-mid", "refract-tier-high"]
                .forEach(function (c) { el.classList.remove(c); });
            /* Also clear any prior card-tier class on the enclosing card so
               a re-rendered banner with a new value (or no value) doesn't
               leave the old tier glow lingering. */
            var card = el.closest(".performer-card, .scene-card");
            var cardTiers = ["bronze", "silver", "gold", "diamond", "legendary", "perfect"];
            if (card) {
                cardTiers.forEach(function (t) {
                    card.classList.remove("refract-card-tier-" + t);
                });
                card.style.removeProperty("--refract-rating");
            }
            if (!rating100 || v <= 0) {
                el.style.removeProperty("--refract-rating");
                return;
            }
            el.style.setProperty("--refract-rating", String(v));
            if (v <= 3.4) { el.classList.add("refract-tier-low"); }
            else if (v <= 6.7) { el.classList.add("refract-tier-mid"); }
            else { el.classList.add("refract-tier-high"); }
            /* Card-frame tier (Bronze→Perfect). Applied in the "tiers"
               rating style (full card-frame treatment) AND in the
               "playing-card" style (drives the name-banner glow at the
               top of each performer card). The "intensity" (mono) mode
               is left untouched: just the existing banner glow that
               scales with --refract-rating. */
            if (card && cardTierEnabled(card) && v >= 5) {
                var tier;
                if (v >= 10)      { tier = "perfect"; }
                else if (v >= 9.5) { tier = "legendary"; }
                else if (v >= 8.5) { tier = "diamond"; }
                else if (v >= 7.5) { tier = "gold"; }
                else if (v >= 6.5) { tier = "silver"; }
                else               { tier = "bronze"; }
                card.classList.add("refract-card-tier-" + tier);
            }
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       Plugin wiring: run loop, DOM watcher, navigation hook, settings UI
       ══════════════════════════════════════════════════════════════════ */
    var observer = null;
    var scheduled = false;

    /* Scene cards get only the tier-name ribbon element (no GraphQL, no
       performer circles — that's the part that ballooned them). The CSS fills
       its text from the card's refract-card-tier-* class via ::after. */
    function injectSceneTierLabels() {
        if (!getSceneOn()) { return; }
        document.querySelectorAll(".scene-card.rc-on:not([data-rc-tl])").forEach(function (card) {
            card.setAttribute("data-rc-tl", "1");
            if (!card.querySelector(":scope > .refract-pc-tier-label")) {
                var d = document.createElement("div");
                d.className = "refract-pc-tier-label";
                card.appendChild(d);
            }
        });
    }

    /* Read a 0-10 rating from a Stash .rating-banner: the modern
       `rating-100-N` class (N = rating100, older builds N = floor/5 0-20),
       the legacy `rating-N` star class, or a textContent fallback. Mirrors
       the parse path in the extracted tagFilledRatings. */
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
                    var stars = document.body.classList.contains("refract-cards-rating-stars");
                    rating100 = Math.min(100, stars ? rawV * 20 : rawV * 10);
                }
            }
        }
        return rating100 == null ? 0 : rating100 / 10;
    }

    /* Scene cards: Stash's native rating banner is hidden by the CSS (it
       reads "Rating: 9.5" and won't fit the badge), so inject a controlled
       direct-child badge showing just the number. It carries the rating-banner
       class (so all the existing badge + tier styling applies) plus rc-injected
       (so the CSS hide rule skips it). Rating is read from the native banner,
       no GraphQL. */
    function injectSceneRatings() {
        if (!getSceneOn()) { return; }
        document.querySelectorAll(".scene-card.rc-on").forEach(function (card) {
            if (card.querySelector(":scope > .rating-banner.rc-injected")) { return; }
            var v10 = 0;
            var banners = card.querySelectorAll(".rating-banner");
            for (var i = 0; i < banners.length; i++) {
                if (banners[i].classList.contains("rc-injected")) { continue; }
                var r = ratingFromBanner(banners[i]);
                if (r > 0) { v10 = r; break; }
            }
            if (v10 <= 0) { return; }
            var stars = document.body.classList.contains("refract-cards-rating-stars");
            var disp = stars ? String(Math.round((v10 / 2) * 100) / 100) : v10.toFixed(1);
            var el = document.createElement("div");
            el.className = "rating-banner rc-injected";
            el.textContent = disp;
            card.appendChild(el);
        });
    }

    /* ── Performer card flip (playing-card mode) ──────────────────────
       Ported from Refract (v1.15.0). The corner flip button reveals a back
       face: a mirrored, heavily blurred frosted version of the performer
       photo behind the advanced-rating category bars (parsed from the
       plugin's `Category: N` tag convention), a stats strip, and a media
       strip. Opt-in per card (you click the button) and built LAZILY on
       first flip, so normal browsing is untouched and no GraphQL runs until
       you actually flip. Playing-card mode + performer cards only. */
    var CARD_BACK_EXPLICIT_KEY = "refractCards.cardBackExplicit";
    /* Explicit card-back labels are built but held back: the toggle is hidden
       and isCardBackExplicit() is forced off while this is false. Flip to true
       to ship the feature (no other change needed). */
    var REFRACT_CARDBACK_EXPLICIT_ENABLED = false;
    var REFRACT_CATEGORY_RE = /^(.+?)\s*:\s*([0-5])$/; /* advanced-rating tag */

    function refractFlipEscHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    var REFRACT_FLIP_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';

    /* Category display order, mirroring the advanced-rating plugin. The plugin
       stores its performer criteria as an ordered `performer_criteria_ids` list
       in its own plugin config, with display names in `performer_name_<id>`. We
       read that same config once (cached) so the card-back ratings sit in the
       exact order the plugin shows them, including any reordering the user does
       in its settings. Until/if that loads we use the plugin's default order. */
    var REFRACT_AR_DEFAULT_NAMES = {
        face: "Face", breasts: "Breasts", ass: "Ass", body: "Body Overall",
        genitals: "Genitals", technique: "Technique",
        energy: "Energy & Presence", sluttiness: "Sluttiness"
    };
    var REFRACT_AR_CAT_ORDER = ["face", "breasts", "ass", "body overall", "genitals",
        "technique", "energy & presence", "sluttiness"];
    var refractAROrderLoaded = false;
    function refractLoadARCategoryOrder() {
        if (refractAROrderLoaded) { return; }
        refractAROrderLoaded = true;
        try {
            gql("query { configuration { plugins } }").then(function (res) {
                var plugins = res && res.data && res.data.configuration && res.data.configuration.plugins;
                var cfg = plugins && plugins.advancedRating;
                if (!cfg) { return; }
                var raw = cfg.performer_criteria_ids;
                if (typeof raw !== "string" || !raw.trim()) { return; }
                var order = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean)
                    .map(function (id) {
                        var nm = cfg["performer_name_" + id] || REFRACT_AR_DEFAULT_NAMES[id] || id;
                        return String(nm).toLowerCase();
                    });
                if (order.length) { REFRACT_AR_CAT_ORDER = order; }
            }).catch(function () {});
        } catch (e) {}
    }

    function injectPerformerCardFlip() {
        if (!document.body.classList.contains("refract-cards-playing")) { return; }
        if (!getPerfOn()) { return; }
        refractLoadARCategoryOrder();
        /* Only marked (rc-on) performer cards get the flip affordance, matching
           the rest of the playing-card styling. */
        var cards = document.querySelectorAll(".performer-card.rc-on:not([data-refract-flip])");
        for (var i = 0; i < cards.length; i++) {
            (function (card) {
                card.setAttribute("data-refract-flip", "1");
                var link = card.querySelector('a[href*="/performers/"]');
                var m = link && (link.getAttribute("href") || "").match(/\/performers\/(\d+)/);
                if (!m) { return; }
                var pid = m[1];
                var btn = document.createElement("button");
                btn.className = "refract-card-flip-btn";
                btn.type = "button";
                btn.title = "Flip card";
                btn.setAttribute("aria-label", "Flip card");
                btn.innerHTML = REFRACT_FLIP_ICON;
                btn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    refractDoPerformerFlip(card, pid);
                });
                card.appendChild(btn);
            })(cards[i]);
        }
    }

    /* Two-phase flip: spin the whole card to its edge (rotateY -90deg, where
       it foreshortens to an invisible vertical line), swap front<->back
       content at that hidden midpoint, then spin back to face-on. The card
       rests at rotateY(0) either way, so the back is never mirrored and the
       state survives a React re-render (no leftover inline transform). A true
       preserve-3d two-face flip isn't possible here: the card needs
       overflow:hidden (rounded corners + the tier ribbon clip), which forces
       transform-style:flat. */
    function refractDoPerformerFlip(card, pid) {
        if (card._rfxFlipBusy) { return; }
        var toBack = !card.classList.contains("refract-show-back");
        if (toBack && !card.querySelector(".refract-card-back")) {
            refractBuildPerformerBack(card, pid);
        }
        card._rfxFlipBusy = true;
        card.style.zIndex = "200";
        /* Phase 1: turn to the edge (-90deg). */
        card.style.transition = "transform 0.24s ease-in";
        card.style.transform = "perspective(1200px) rotateY(-90deg)";
        setTimeout(function () {
            /* At the invisible edge, swap faces, then TELEPORT across to the
               mirror edge (+90deg, also edge-on and invisible) with transitions
               off. Finishing the same-direction turn (+90 -> 0) reads as one
               continuous flip, and BOTH faces come to rest at rotateY(0) so
               nothing is ever mirrored (no scaleX trickery, no accumulation,
               and the state survives a React re-render). */
            if (toBack) { card.classList.add("refract-show-back"); }
            else { card.classList.remove("refract-show-back"); }
            card.style.transition = "none";
            card.style.transform = "perspective(1200px) rotateY(90deg)";
            void card.offsetWidth;
            /* Phase 2: finish the turn to face-on. */
            card.style.transition = "transform 0.24s ease-out";
            card.style.transform = "perspective(1200px) rotateY(0deg)";
            setTimeout(function () {
                card.style.transition = "";
                card.style.transform = "";
                card.style.zIndex = "";
                card._rfxFlipBusy = false;
            }, 250);
        }, 235);
    }

    function refractBuildPerformerBack(card, pid) {
        var back = document.createElement("div");
        back.className = "refract-card-back";
        var img = card.querySelector("img.performer-card-image");
        var imgSrc = img ? (img.getAttribute("src") || "") : "";
        var nameEl = card.querySelector(".performer-name");
        var name = nameEl ? (nameEl.textContent || "").trim() : "";
        var tier = "";
        var cl = (card.className || "").match(/refract-card-tier-(\w+)/);
        if (cl) { tier = cl[1]; }
        var photo = imgSrc
            ? ' style="background-image:url(\'' + imgSrc.replace(/'/g, "%27") + '\')"' : '';

        /* Fixed, NON-SCROLLING dossier with the STATS as the hero: a title bar
           (name top-left, tier chip top-right), a hero row pairing the portrait
           beside the score banner, a 3-up media strip (top scene + library
           photos), then the category "Assets" as the large flex body (one
           readable row each), and a collector footer of library stats. */
        back.innerHTML =
            '<div class="refract-back-photo"' + photo + '></div>' +
            '<div class="refract-back-frost"></div>' +
            '<div class="refract-cb refract-cb-tier-' + (tier || 'none') + '">' +
            '<div class="refract-cb-head">' +
            '<span class="refract-cb-title">' +
            '<span class="refract-cb-name">' + refractFlipEscHtml(name) + '</span>' +
            '</span>' +
            (tier ? '<span class="refract-cb-tierchip">' + tier + '</span>' : '') +
            '</div>' +
            '<div class="refract-cb-hero">' +
            '<div class="refract-cb-portrait"' + photo + '></div>' +
            '<div class="refract-cb-score refract-cb-score-empty"></div>' +
            '</div>' +
            '<div class="refract-cb-assets"><div class="refract-cb-loading">Loading</div></div>' +
            '<div class="refract-cb-media refract-cb-media-loading">' +
            '<div class="refract-cb-media-item"><div class="refract-cb-media-img"' + photo + '></div></div>' +
            '</div>' +
            '<div class="refract-cb-foot"></div>' +
            '</div>';
        card.appendChild(back);

        /* Gender "type" glyph before the name, cloned from the card's native
           gender icon (same source the front name-banner uses). Carries its
           data-gender attribute so the per-gender glow CSS applies here too. */
        var genderSrc = card.querySelector(".gender-icon");
        var titleEl2 = back.querySelector(".refract-cb-title");
        var nameEl2 = back.querySelector(".refract-cb-name");
        if (genderSrc && titleEl2 && nameEl2) {
            var gIcon = genderSrc.cloneNode(true);
            gIcon.classList.add("refract-cb-gender");
            titleEl2.insertBefore(gIcon, nameEl2);
        }

        var q =
            'query RefractFlip($id: ID!) {' +
            '  findPerformer(id: $id) { id rating100 favorite o_counter scene_count measurements height_cm weight career_length tags { id name } }' +
            '  findScenes(scene_filter: { performers: { value: [$id], modifier: INCLUDES } }, filter: { per_page: 3, sort: "rating", direction: DESC }) { scenes { id title rating100 paths { screenshot } } }' +
            '  findImages(image_filter: { performers: { value: [$id], modifier: INCLUDES } }, filter: { per_page: 3, sort: "rating", direction: DESC }) { images { id paths { thumbnail } } }' +
            '}';
        gqlWithVars(q, { id: pid }).then(function (res) {
            var d = res && res.data;
            var p = d && d.findPerformer;
            var scenes = d && d.findScenes && d.findScenes.scenes;
            var images = d && d.findImages && d.findImages.images;
            if (p) { refractFillPerformerBack(back, p, scenes, images); }
        }).catch(function () {
            var l = back.querySelector(".refract-cb-loading");
            if (l) { l.textContent = "Couldn't load stats"; }
        });
    }

    function isCardBackExplicit() {
        if (!REFRACT_CARDBACK_EXPLICIT_ENABLED) { return false; }
        try { return localStorage.getItem(CARD_BACK_EXPLICIT_KEY) === "1"; }
        catch (e) { return false; }
    }

    /* Career span in whole years, parsed from the free-text career_length
       ("2014 -", "2014-2020", etc.). Open-ended ranges count up to now; a
       non-year string passes through if it's short enough to fit a chip. */
    function refractCareerYears(cl) {
        if (!cl) { return ""; }
        var s = String(cl).replace(/\s+/g, " ").trim();
        var ys = s.match(/\d{4}/g);
        if (ys && ys.length) {
            var start = parseInt(ys[0], 10);
            var end = ys.length > 1 ? parseInt(ys[1], 10) : (new Date()).getFullYear();
            var span = end - start;
            if (span < 0) { span = 0; }
            return span + (span === 1 ? " yr" : " yrs");
        }
        return s.length <= 12 ? s : "";
    }

    /* Media-strip click -> open the scene/image. SPA-navigate via pushState +
       popstate (Stash's React Router responds to popstate), but leave
       ctrl/cmd/middle-click to the native href so new-tab still works. */
    function refractMediaNavClick(e) {
        var a = (e.target && e.target.closest) ? e.target.closest(".refract-cb-media-item") : null;
        if (!a) { return; }
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) { return; }
        var href = a.getAttribute("href");
        if (!href) { return; }
        e.preventDefault();
        e.stopPropagation();
        if (window.location.pathname + window.location.search !== href) {
            window.history.pushState(null, "", href);
            window.dispatchEvent(new PopStateEvent("popstate"));
        }
    }

    function refractFillPerformerBack(back, p, scenes, images) {
        var explicit = isCardBackExplicit();
        var L = explicit ? {
            score: "Slut Score", assets: "Assets", scenes: "On-Cam Fucks", o: "Loads", topscene: "Best Fuck"
        } : {
            score: "Rating", assets: "Ratings", scenes: "Scenes", o: "O-Count", topscene: "Top Scene"
        };

        /* Headline score (the overall rating100 / "slut score") - the hero. */
        var score = back.querySelector(".refract-cb-score");
        if (score) {
            score.classList.remove("refract-cb-score-empty");
            score.innerHTML =
                '<div class="refract-cb-score-num">' + (p.rating100 != null ? p.rating100 : "--") + '</div>' +
                '<div class="refract-cb-score-lbl">' + L.score + '</div>' +
                (p.favorite ? '<span class="refract-cb-fav" title="Favourite">&#10084;</span>' : '');
        }

        /* Media strip: lead with the top scene (labelled + rated), then the
           performer's top-rated library photos, then any remaining scenes as
           stills. Up to three; all lazy (only fetched on flip). Falls back to
           the portrait placeholder when she has no scenes or photos. */
        var mediaEl = back.querySelector(".refract-cb-media");
        if (mediaEl) {
            mediaEl.classList.remove("refract-cb-media-loading");
            var media = [];
            var top = scenes && scenes[0];
            if (top && top.paths && top.paths.screenshot) {
                media.push({ url: top.paths.screenshot, tag: L.topscene, rate: top.rating100, href: "/scenes/" + top.id });
            }
            (images || []).forEach(function (im) {
                if (media.length >= 3) { return; }
                if (im && im.paths && im.paths.thumbnail) { media.push({ url: im.paths.thumbnail, href: "/images/" + im.id }); }
            });
            (scenes || []).slice(1).forEach(function (sc) {
                if (media.length >= 3) { return; }
                if (sc && sc.paths && sc.paths.screenshot) { media.push({ url: sc.paths.screenshot, href: "/scenes/" + sc.id }); }
            });
            if (media.length) {
                mediaEl.innerHTML = media.map(function (m) {
                    var tag = m.tag ? '<span class="refract-cb-media-tag">' + refractFlipEscHtml(m.tag) + '</span>' : '';
                    var rate = (m.rate != null) ? '<span class="refract-cb-media-rate">&#9733; ' + m.rate + '</span>' : '';
                    return '<a class="refract-cb-media-item" href="' + refractFlipEscHtml(m.href) + '">' +
                        '<div class="refract-cb-media-img" style="background-image:url(\'' +
                        String(m.url).replace(/'/g, "%27") + '\')"></div>' + tag + rate + '</a>';
                }).join("");
                mediaEl.addEventListener("click", refractMediaNavClick);
            }
        }

        /* Category ratings ("Assets") - the main body, one readable row each
           (name, full-width meter bar and the 0-5 value). FIXED order, matching
           the advanced-rating plugin's own criteria order (so each category
           always sits in the same row); anything the plugin doesn't list falls
           to the end alphabetically. The list scrolls if it overflows. Parsed
           from advanced-rating's `Category: N` tags. */
        var cats = [];
        (p.tags || []).forEach(function (t) {
            var nm = t.name || "";
            var mm = nm.match(REFRACT_CATEGORY_RE);
            if (mm) { cats.push({ name: mm[1].replace(/[\W_]+$/, "").trim(), score: parseInt(mm[2], 10) }); }
        });
        cats.sort(function (a, b) {
            var an = a.name.toLowerCase(), bn = b.name.toLowerCase();
            var ia = REFRACT_AR_CAT_ORDER.indexOf(an); if (ia === -1) { ia = 999; }
            var ib = REFRACT_AR_CAT_ORDER.indexOf(bn); if (ib === -1) { ib = 999; }
            if (ia !== ib) { return ia - ib; }
            return an < bn ? -1 : (an > bn ? 1 : 0);
        });
        var shown = cats;
        var assets = back.querySelector(".refract-cb-assets");
        if (assets) {
            var h = '<div class="refract-cb-assets-head"><span>' + L.assets + '</span>' +
                (cats.length ? '<span class="refract-cb-assets-n">' + cats.length + '</span>' : '') + '</div>';
            if (shown.length) {
                h += '<div class="refract-cb-grid">';
                shown.forEach(function (c) {
                    var segs = "";
                    for (var s = 1; s <= 5; s++) { segs += '<span class="refract-cb-seg' + (s <= c.score ? " on" : "") + '"></span>'; }
                    h += '<div class="refract-cb-stat refract-s' + c.score + '"><span class="refract-cb-stat-name">' +
                        refractFlipEscHtml(c.name) + '</span><span class="refract-cb-bar">' + segs + '</span>' +
                        '<span class="refract-cb-stat-val">' + c.score + '</span></div>';
                });
                h += '</div>';
            } else {
                h += '<div class="refract-cb-empty">No ' + (explicit ? 'assets rated' : 'category ratings') + ' yet</div>';
            }
            assets.innerHTML = h;
        }

        /* Collector footer: library counts beside physical/career vitals,
           each shown only if set. */
        var foot = back.querySelector(".refract-cb-foot");
        if (foot) {
            var fi = [];
            if (p.scene_count != null) { fi.push([L.scenes, p.scene_count]); }
            if (p.o_counter != null && p.o_counter > 0) { fi.push([L.o, p.o_counter]); }
            if (p.measurements) { fi.push(["Meas", p.measurements]); }
            if (p.height_cm) { fi.push(["Height", p.height_cm + "cm"]); }
            if (p.weight) { fi.push(["Weight", p.weight + "kg"]); }
            var cy = refractCareerYears(p.career_length);
            if (cy) { fi.push(["Career", cy]); }
            foot.innerHTML = fi.map(function (it) {
                return '<span class="refract-cb-foot-item"><b>' + refractFlipEscHtml(String(it[1])) +
                    '</b>' + refractFlipEscHtml(String(it[0])) + '</span>';
            }).join("");
        }
    }

    /* Default performer placeholder recolour (ported from the Refract theme).
       When a performer has no image, Stash serves a white silhouette SVG whose
       img src carries `default=true`; white-on-white with the card name is
       unreadable (worst in lite mode). An <img> can't be recoloured via CSS,
       so for each placeholder on a styled (rc-on) performer card we overlay a
       span masked by the same silhouette shape, fill it with a translucent
       accent, and fade the white original. The mask URL is made same-origin
       (strip the host) so it isn't blocked when Stash is opened on a different
       origin than the image host. Guarded by the overlay's presence so it
       survives React replacing the surrounding nodes. */
    function tintDefaultPerformerImages() {
        var imgs = document.querySelectorAll('.performer-card.rc-on img.performer-card-image[src*="default=true"]');
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            var parent = img.parentElement;
            if (!parent) { continue; }
            if (parent.querySelector(":scope > .refract-default-perf-silhouette")) { continue; }
            if (getComputedStyle(parent).position === "static") {
                parent.style.position = "relative";
            }
            var rel = (img.getAttribute("src") || "").replace(/^https?:\/\/[^/]+/, "");
            var ov = document.createElement("span");
            ov.className = "refract-default-perf-silhouette";
            ov.style.setProperty("-webkit-mask-image", 'url("' + rel + '")');
            ov.style.setProperty("mask-image", 'url("' + rel + '")');
            img.classList.add("refract-default-perf-img");
            parent.appendChild(ov);
        }
    }

    function runAll() {
        addScope();
        if (observer) { observer.disconnect(); }
        safeRun(applyCardScope);
        safeRun(injectSceneTierLabels);
        safeRun(injectSceneRatings);
        safeRun(initCardTilts);
        /* initSceneCards (Refract's scene-card redesign: performer-avatar
           circles + tag-count badges via GraphQL) is intentionally NOT run.
           Its sizing depends on Refract's scene-card layout + rating-style
           modes that don't exist here, so on the default theme the circles/
           badges render unsized and balloon the card. Scene cards still get
           the base glass look + tilt + tier frames — tiers are read from the
           native rating banner by tagFilledRatings(), no injection needed. */
        safeRun(initPerformerCards);
        safeRun(injectPerformerCardFlip);
        safeRun(tintDefaultPerformerImages);
        safeRun(syncPerformerCardHearts);
        safeRun(integrateAscensionBadges);
        safeRun(tagFilledRatings);
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

    /* Settings changed from the panel: re-apply body classes + re-run so the
       change shows immediately without a reload. */
    function onSettingsChanged() {
        applyModeClasses();
        runAll();
    }

    /* ── Settings panel (replaces the native plugin settings row) ──────────
       Three on/off switches. Each turns Refract styling on or off for a card
       group; off = the default Stash card for that group. */
    function buildSettingsComponent(R) {
        return function RefractCardsSettings() {
            var perf  = R.useState(getPerfOn());
            var scene = R.useState(getSceneOn());
            var other = R.useState(getOtherOn());
            var lite  = R.useState(getLiteOn());

            function makeToggle(key, state, setState) {
                return function () { var v = !state[0]; setBool(key, v); state[1](v); onSettingsChanged(); };
            }
            var togglePerf  = makeToggle(PERF_KEY, perf, perf);
            var toggleScene = makeToggle(SCENE_KEY, scene, scene);
            var toggleOther = makeToggle(OTHER_KEY, other, other);
            var toggleLite  = makeToggle(LITE_KEY, lite, lite);

            function row(id, title, desc, checked, onChange) {
                return R.createElement("div", { className: "setting", id: id },
                    R.createElement("div", null,
                        R.createElement("h3", null, title),
                        R.createElement("div", { className: "sub-heading" }, desc)
                    ),
                    R.createElement("div", { className: "refract-cards-control" },
                        R.createElement("div", { className: "custom-control custom-switch" },
                            R.createElement("input", {
                                type: "checkbox", className: "custom-control-input",
                                id: id + "-toggle", checked: checked, onChange: onChange
                            }),
                            R.createElement("label", { className: "custom-control-label", htmlFor: id + "-toggle" })
                        )
                    )
                );
            }

            return R.createElement("div", { className: "plugin-settings refract-cards-settings" },
                row("refract-cards-perf", "Performer cards",
                    "Full playing-card layout: name banner with tier glow, diagonal tier ribbon, neon stat strip (rating, age, scenes, O count, country), and floating hearts on favourites.",
                    perf[0], togglePerf),
                row("refract-cards-scene", "Scene cards",
                    "The classic Refract card: glass surface, hover glow, 3D tilt, and the Bronze → Perfect tier frame on rated cards.",
                    scene[0], toggleScene),
                row("refract-cards-other", "Everything else",
                    "Apply the base Refract card styling (glass, hover glow, 3D tilt) to all other card types - galleries, images, studios, tags, groups, and markers.",
                    other[0], toggleOther),
                row("refract-cards-lite", "Lite mode",
                    "A flatter, calmer look: keeps the rating-tier colours, a static tier frame, and the rating banners, but drops the glass glow, the breathing tier animations, the hover glow, the 3D tilt, and the floating hearts. Lighter to run.",
                    lite[0], toggleLite),
                R.createElement("div", { className: "setting" },
                    R.createElement("div", { className: "sub-heading" },
                        "Saved per browser, applied instantly. Don't run this alongside the full Refract theme.")
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

    /* Re-run card augmentation on Stash SPA navigation (PluginApi event), in
       addition to the MutationObserver. */
    if (typeof PluginApi !== "undefined" && PluginApi && PluginApi.Event && PluginApi.Event.addEventListener) {
        PluginApi.Event.addEventListener("stash:location", function () {
            nextTick(scheduleRun);
        });
    }

    /* ── Boot ───────────────────────────────────────────────────────────── */
    function boot() {
        addScope();
        applyModeClasses();
        safeRun(refractFetchRatingSystem);
        startObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
