(function () {
    'use strict';

    if (window.urlSwitcherLoaded) return;
    window.urlSwitcherLoaded = true;

    const PLUGIN_ID = 'urlSwitcher';

    async function getConfig() {
        try {
            const res = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: 'query { configuration { plugins } }' })
            });
            const data = await res.json();
            return data.data?.configuration?.plugins?.[PLUGIN_ID] || {};
        } catch (e) {
            return {};
        }
    }

    function originOf(url) {
        if (!url) return null;
        try {
            return new URL(url.trim().replace(/\/+$/, '')).origin;
        } catch (e) {
            return null;
        }
    }

    let localOrigin = null;
    let tunnelOrigin = null;

    // fa-cloud: clean single-path cloud icon
    const SWITCH_ICON_SVG = `<svg aria-hidden="true" focusable="false" class="svg-inline--fa fa-icon" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M0 336c0 79.5 64.5 144 144 144l368 0c70.7 0 128-57.3 128-128c0-61.9-43.8-113.6-102.4-125.4c4.1-10.7 6.4-22.4 6.4-34.6c0-53-43-96-96-96c-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32C167.6 32 96 103.6 96 192c0 2.7 .1 5.4 .2 8.1C40.2 219.8 0 273.2 0 336z"/></svg>`;

    function makeBtnInner() {
        return `<button class="btn minimal d-flex align-items-center h-100">${SWITCH_ICON_SVG}</button>`;
    }

    function refreshButton() {
        if (!localOrigin || !tunnelOrigin) return;

        const currentOrigin = window.location.origin;
        const isOnLocal = currentOrigin === localOrigin;
        const isOnTunnel = currentOrigin === tunnelOrigin;

        if (!isOnLocal && !isOnTunnel) return;

        const targetOrigin = isOnLocal ? tunnelOrigin : localOrigin;
        const href = targetOrigin + window.location.pathname + window.location.search + window.location.hash;
        const title = isOnLocal ? 'Switch to Cloudflare Tunnel' : 'Switch to Local';
        const modeClass = isOnTunnel ? ' mode-tunnel' : '';

        // --- Primary button: in .navbar-buttons (always-visible right side) ---
        let btn = document.getElementById('url-switcher-btn');
        if (!btn) {
            const navbarButtons = document.querySelector('.navbar-buttons');
            const settingsLink = navbarButtons?.querySelector('a[href="/settings"]');
            if (navbarButtons && settingsLink) {
                btn = document.createElement('a');
                btn.id = 'url-switcher-btn';
                btn.className = 'nav-utility url-switcher-link' + modeClass;
                btn.innerHTML = makeBtnInner();

                let anchor = settingsLink;
                while (anchor.parentElement && anchor.parentElement !== navbarButtons) {
                    anchor = anchor.parentElement;
                }
                anchor.after(btn);
            }
        }
        if (btn) {
            btn.href = href;
            btn.title = title;
        }

        // --- Dropdown copy: in .navbar-collapse .navbar-nav:last-child (xs hamburger menu) ---
        // Stash renders utility buttons there too so they appear in the xs dropdown
        let btnXs = document.getElementById('url-switcher-btn-xs');
        if (!btnXs) {
            const collapseLastNav = document.querySelector('.navbar-collapse .navbar-nav:last-child');
            const settingsXs = collapseLastNav?.querySelector('a[href="/settings"]');
            if (collapseLastNav && settingsXs) {
                btnXs = document.createElement('a');
                btnXs.id = 'url-switcher-btn-xs';
                btnXs.className = settingsXs.className.replace(/\bactive\b/g, '').trim() + ' url-switcher-link' + modeClass;
                btnXs.innerHTML = settingsXs.innerHTML;

                let anchorXs = settingsXs;
                while (anchorXs.parentElement && anchorXs.parentElement !== collapseLastNav) {
                    anchorXs = anchorXs.parentElement;
                }
                anchorXs.after(btnXs);
            }
        }
        if (btnXs) {
            btnXs.href = href;
            btnXs.title = title;
            // Replace the inner icon with the switcher icon (keep same structure as settings)
            const iconEl = btnXs.querySelector('.svg-inline--fa, svg');
            if (iconEl) {
                const tmp = document.createElement('div');
                tmp.innerHTML = SWITCH_ICON_SVG;
                iconEl.replaceWith(tmp.firstChild);
            }
        }
    }

    async function init() {
        const config = await getConfig();
        localOrigin = originOf(config.local_url);
        tunnelOrigin = originOf(config.tunnel_url);

        if (!localOrigin || !tunnelOrigin) {
            console.warn('[URL Switcher] Configure local_url and tunnel_url in plugin settings.');
            return;
        }

        refreshButton();

        if (typeof PluginApi !== 'undefined' && PluginApi?.Event?.addEventListener) {
            PluginApi.Event.addEventListener('stash:location', refreshButton);
        }

        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            if (document.getElementById('url-switcher-btn') || attempts >= 30) {
                clearInterval(poll);
            } else {
                refreshButton();
            }
        }, 300);
    }

    init();
})();
