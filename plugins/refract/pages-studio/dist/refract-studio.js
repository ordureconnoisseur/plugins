(function() {
  "use strict";
  const host$1 = window;
  const React = host$1.PluginApi && host$1.PluginApi.React;
  if (!React) {
    throw new Error("refract-studio: PluginApi.React is not available");
  }
  const R = React;
  R.createElement;
  R.cloneElement;
  R.Fragment;
  R.Component;
  R.memo;
  R.forwardRef;
  R.createContext;
  const useState = R.useState;
  const useEffect = R.useEffect;
  const useLayoutEffect = R.useLayoutEffect;
  const useMemo = R.useMemo;
  const useCallback = R.useCallback;
  const useRef = R.useRef;
  R.useContext;
  R.useReducer;
  R.isValidElement;
  R.Children;
  const host = window;
  const ReactDOM = host.PluginApi && host.PluginApi.ReactDOM;
  if (!ReactDOM) {
    throw new Error("refract-studio: PluginApi.ReactDOM is not available");
  }
  const D = ReactDOM;
  D.createPortal;
  D.flushSync;
  function pluginApi() {
    return window.PluginApi;
  }
  function stashComponent(name) {
    const api = pluginApi();
    const reg = api && api.components;
    if (!reg) return void 0;
    return reg[name];
  }
  function haveComponents(names) {
    for (const n of names) {
      if (!stashComponent(n)) return false;
    }
    return true;
  }
  function formattedMessage() {
    const api = pluginApi();
    const intl = api && api.libraries && api.libraries.Intl;
    const fm = intl && intl.FormattedMessage;
    return typeof fm === "function" ? fm : void 0;
  }
  function mousetrap() {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Mousetrap || void 0;
  }
  const announced = {};
  function announceOnce(what) {
    if (announced[what]) return;
    announced[what] = true;
    try {
      console.info("[refract-studio] " + what);
    } catch {
    }
  }
  function warnOnce(what, err) {
    if (announced["warn:" + what]) return;
    announced["warn:" + what] = true;
    try {
      if (err === void 0) console.warn("[refract-studio] " + what);
      else console.warn("[refract-studio] " + what, err);
    } catch {
    }
  }
  const HOST_CLASS = "refract-sr-host";
  let hostSeq = 0;
  function pageRoot() {
    try {
      return document.querySelector("#studio-page");
    } catch {
      return null;
    }
  }
  function usePortalContainer(active) {
    const [node, setNode] = useState(null);
    useEffect(() => {
      if (!active) {
        setNode(null);
        return void 0;
      }
      const root = pageRoot();
      if (!root) {
        warnOnce("no #studio-page to mount into");
        return void 0;
      }
      const existing = root.querySelector(":scope > ." + HOST_CLASS);
      if (existing) {
        return void 0;
      }
      hostSeq += 1;
      const el = document.createElement("div");
      el.className = HOST_CLASS;
      el.setAttribute("data-refract-host", String(hostSeq));
      root.appendChild(el);
      setNode(el);
      return () => {
        setNode(null);
        if (el.parentNode) el.parentNode.removeChild(el);
      };
    }, [active]);
    return node;
  }
  function useBodyClass(cls, on) {
    useEffect(() => {
      if (!on) return void 0;
      try {
        if (document.body) document.body.classList.add(cls);
      } catch {
      }
      return () => {
        try {
          if (document.body) document.body.classList.remove(cls);
        } catch {
        }
      };
    }, [cls, on]);
  }
  const PortalHost = ({ active, bodyClass, children }) => {
    const container = usePortalContainer(active);
    useBodyClass(bodyClass, active && !!container);
    useEffect(() => {
      if (!container) return;
      announceOnce(
        "mounted through StudioDetailsPanel" + (stashComponent("StudioPage") ? "" : ", because StudioPage is not a patch point on this Stash (needs newer than 0.31.1, stashapp/stash #6967)")
      );
    }, [container]);
    if (!active || !container) return null;
    return D.createPortal(children, container);
  };
  const TRIES = 30;
  const EVERY = 50;
  const FOCUSABLE = 'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),iframe,object,embed,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
  function topModal() {
    const modals = document.querySelectorAll(".modal.show");
    return modals[modals.length - 1] || null;
  }
  function focusables(modal) {
    const all = Array.prototype.slice.call(
      modal.querySelectorAll(FOCUSABLE)
    );
    return all.filter((el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }
  function useCancelFocus(open) {
    useEffect(() => {
      if (!open) return void 0;
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        if (tries > TRIES) {
          window.clearInterval(t);
          return;
        }
        try {
          const modal = topModal();
          if (!modal) return;
          const buttons = modal.querySelectorAll(".modal-footer button");
          const cancel = buttons[buttons.length - 1];
          if (!cancel) return;
          cancel.focus();
          if (document.activeElement === cancel) window.clearInterval(t);
        } catch {
          window.clearInterval(t);
        }
      }, EVERY);
      const onKeyDown = (e) => {
        if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
        let modal = null;
        let stops = [];
        try {
          modal = topModal();
          if (!modal) return;
          stops = focusables(modal);
        } catch {
          return;
        }
        if (!stops.length) return;
        const active = document.activeElement;
        const inside = !!(active && modal.contains(active));
        const at = active ? stops.indexOf(active) : -1;
        if (!inside) {
          e.preventDefault();
          modal.focus();
          return;
        }
        if (active === modal) {
          if (e.shiftKey) {
            e.preventDefault();
            stops[stops.length - 1].focus();
          }
          return;
        }
        if (!e.shiftKey && at === stops.length - 1) {
          e.preventDefault();
          modal.focus();
          return;
        }
        if (e.shiftKey && at === 0) {
          e.preventDefault();
          modal.focus();
        }
      };
      document.addEventListener("keydown", onKeyDown, true);
      return () => {
        window.clearInterval(t);
        document.removeEventListener("keydown", onKeyDown, true);
      };
    }, [open]);
  }
  function stashService() {
    const api = pluginApi();
    return api && api.utils && api.utils.StashService || {};
  }
  const studioUpdateHook = stashService().useStudioUpdate;
  const studioDestroyHook = stashService().useStudioDestroy;
  const noopTuple = [
    () => Promise.reject(new Error("refract-studio: mutation unavailable")),
    void 0
  ];
  const canUpdateStudio = !!studioUpdateHook;
  const canDestroyStudio = !!studioDestroyHook;
  function useStudioUpdate() {
    if (!studioUpdateHook) return noopTuple;
    return studioUpdateHook();
  }
  function useStudioDestroy(id) {
    if (!studioDestroyHook) {
      return noopTuple;
    }
    return studioDestroyHook({ id });
  }
  const routerLibrary = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.ReactRouterDOM;
  })();
  const useRouterHistory = routerLibrary && routerLibrary.useHistory;
  const useRouterLocation = routerLibrary && routerLibrary.useLocation;
  function useHistory() {
    if (useRouterHistory) return useRouterHistory();
    return {
      push: (to) => {
        window.location.href = to;
      },
      replace: (to) => {
        window.location.replace(to);
      }
    };
  }
  function useLocationPath() {
    if (useRouterLocation) return useRouterLocation().pathname;
    return window.location.pathname;
  }
  const configurationHook = stashService().useConfiguration;
  function useUiConfig() {
    const result = configurationHook ? configurationHook() : void 0;
    const data = result && result.data;
    return data && data.configuration && data.configuration.ui || {};
  }
  function useRatingSystemOptions() {
    const result = configurationHook ? configurationHook() : void 0;
    const data = result && result.data;
    const ui = data && data.configuration && data.configuration.ui;
    return ui && ui.ratingSystemOptions || {};
  }
  const ARM_MS = 1e3;
  const claimed = {};
  let original;
  function install() {
    const mt = mousetrap();
    if (!mt || original) return;
    const origBind = mt.bind;
    const origUnbind = mt.unbind;
    original = { bind: origBind, unbind: origUnbind };
    mt.bind = function(key, fn) {
      const r = origBind.call(mt, key, fn);
      const mine = claimed[key];
      if (mine && fn !== mine) origBind.call(mt, key, mine);
      return r;
    };
    mt.unbind = function(key) {
      const r = origUnbind.call(mt, key);
      const mine = claimed[key];
      if (mine) origBind.call(mt, key, mine);
      return r;
    };
    original.ourBind = mt.bind;
    original.ourUnbind = mt.unbind;
  }
  function uninstall() {
    const mt = mousetrap();
    if (!mt || !original) return;
    for (const k in claimed) {
      if (Object.prototype.hasOwnProperty.call(claimed, k)) return;
    }
    if (mt.bind !== original.ourBind || mt.unbind !== original.ourUnbind) return;
    mt.bind = original.bind;
    mt.unbind = original.unbind;
    original = void 0;
  }
  function claim(keys, handlers) {
    const mt = mousetrap();
    if (!mt) return;
    install();
    for (const key of keys) {
      claimed[key] = handlers[key];
      mt.bind(key, handlers[key]);
    }
  }
  function release(keys) {
    for (const key of keys) delete claimed[key];
    unbindAll(keys);
    uninstall();
  }
  const STAR_SHORTCUTS = {
    "0": NaN,
    "1": 20,
    "2": 40,
    "3": 60,
    "4": 80,
    "5": 100
  };
  function modalOpen() {
    try {
      if (document.body && document.body.classList.contains("modal-open")) return true;
      return !!document.querySelector(".modal.show");
    } catch {
      return false;
    }
  }
  function unbindAll(keys) {
    const mt = mousetrap();
    if (!mt) return;
    for (const key of keys) {
      try {
        mt.unbind(key);
      } catch {
      }
    }
  }
  function usePageKeybinds(binds, active = true) {
    const latest = useRef(binds);
    latest.current = binds;
    useEffect(() => {
      if (!active) return void 0;
      const mt = mousetrap();
      if (!mt) return void 0;
      const keys = Object.keys(latest.current);
      const handlers = {};
      for (const key of keys) {
        handlers[key] = () => {
          if (modalOpen()) return;
          const fn = latest.current[key];
          if (fn) fn();
        };
      }
      claim(keys, handlers);
      return () => release(keys);
    }, [active]);
  }
  function useRatingKeybinds(setRating, active = true) {
    const firstChar = useRef(void 0);
    const latest = useRef(setRating);
    latest.current = setRating;
    const options = useRatingSystemOptions();
    const starsMode = options.type !== "decimal";
    const stars = useRef(starsMode);
    stars.current = starsMode;
    useEffect(() => {
      if (!active) return void 0;
      const mt = mousetrap();
      if (!mt) return void 0;
      function armStars() {
        const m = mousetrap();
        if (!m) return;
        const keys = Object.keys(STAR_SHORTCUTS);
        for (const key of keys) {
          m.bind(key, () => {
            if (modalOpen()) return;
            latest.current(STAR_SHORTCUTS[key]);
          });
        }
        window.setTimeout(() => unbindAll(keys), ARM_MS);
      }
      function armDecimal() {
        const m = mousetrap();
        if (!m) return;
        const keys = ["`"];
        m.bind("`", () => {
          if (modalOpen()) return;
          latest.current(NaN);
        });
        for (let i = 0; i <= 9; ++i) {
          const digit = String(i);
          keys.push(digit);
          m.bind(digit, () => {
            if (modalOpen()) return;
            if (firstChar.current !== void 0) {
              let combined = parseInt(firstChar.current + digit, 10);
              if (combined === 0) combined = 100;
              latest.current(combined);
              firstChar.current = void 0;
            } else {
              firstChar.current = digit;
            }
          });
        }
        window.setTimeout(() => {
          firstChar.current = void 0;
          unbindAll(keys);
        }, ARM_MS);
      }
      function onR() {
        if (modalOpen()) return;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        if (stars.current) armStars();
        else armDecimal();
      }
      claim(["r"], { r: onR });
      return () => release(["r"]);
    }, [active]);
  }
  function num(n) {
    const v = n || 0;
    try {
      return v.toLocaleString();
    } catch {
      return String(v);
    }
  }
  const COUNT_UNITS = ["", "K", "M", "B"];
  function abbreviate(n, on) {
    const v = n || 0;
    if (!on) return num(v);
    let count = v;
    let unit = 0;
    let digits = 0;
    while (count >= 1e3 && unit + 1 < COUNT_UNITS.length) {
      count /= 1e3;
      unit += 1;
      digits = 1;
    }
    try {
      return count.toLocaleString(void 0, { maximumFractionDigits: digits }) + COUNT_UNITS[unit];
    } catch {
      return String(Math.round(count)) + COUNT_UNITS[unit];
    }
  }
  function plain(v) {
    const s = (v || "").trim();
    return s ? s : null;
  }
  function endpointHost(endpoint) {
    try {
      return new URL(endpoint).hostname.replace(/^www\./, "");
    } catch {
      return endpoint;
    }
  }
  function endpointBase(endpoint) {
    return endpoint.replace(/\/graphql\/?$/, "");
  }
  function defaultTab(counts) {
    if (counts.scenes) return "scenes";
    if (counts.galleries) return "galleries";
    if (counts.images) return "images";
    if (counts.performers) return "performers";
    if (counts.groups) return "groups";
    if (counts.children) return "childstudios";
    return "scenes";
  }
  function tierFor(rating100) {
    if (rating100 === null || rating100 === void 0) return void 0;
    const v = rating100 / 10;
    if (v >= 10) return "perfect";
    if (v >= 9.5) return "legendary";
    if (v >= 8.5) return "diamond";
    if (v >= 7.5) return "gold";
    if (v >= 6.5) return "silver";
    if (v >= 5) return "bronze";
    return void 0;
  }
  function ratingDisplay(rating100, starsMode) {
    const v = starsMode ? rating100 / 20 : rating100 / 10;
    return Math.round(v * 10) % 10 === 0 ? String(Math.round(v)) : v.toFixed(1);
  }
  const AUTO_TAG_MESSAGE_IDS = [
    "config.tasks.auto_tag_based_on_filenames",
    "config.tasks.auto_tag_confirm",
    "config.tasks.auto_tag_warning"
  ];
  const AUTO_TAG_FALLBACK = [
    "Auto tag content based on file paths.",
    "This will attempt to match your content against existing metadata.",
    "This process cannot be undone and may produce incorrect matches."
  ];
  const AutoTagWarning = () => {
    const FormattedMessage = formattedMessage();
    if (!FormattedMessage) {
      return /* @__PURE__ */ R.createElement(R.Fragment, null, AUTO_TAG_FALLBACK.map((line) => /* @__PURE__ */ R.createElement("p", { key: line }, line)));
    }
    return /* @__PURE__ */ R.createElement(R.Fragment, null, AUTO_TAG_MESSAGE_IDS.map((id) => /* @__PURE__ */ R.createElement("p", { key: id }, /* @__PURE__ */ R.createElement(FormattedMessage, { id }))));
  };
  const ActionBar = ({ studio, onEdit }) => {
    const [confirming, setConfirming] = useState(false);
    const [confirmingAutoTag, setConfirmingAutoTag] = useState(false);
    const [busy, setBusy] = useState(false);
    const svc = stashService();
    const AlertModal = stashComponent("AlertModal");
    useCancelFocus(confirmingAutoTag);
    useCancelFocus(confirming);
    const autoTag = useCallback(() => {
      setConfirmingAutoTag(false);
      const fn = svc.mutateMetadataAutoTag;
      if (!fn) return;
      setBusy(true);
      fn({ studios: [studio.id] }).catch((e) => warnOnce("could not start auto tagging", e)).then(() => setBusy(false));
    }, [svc, studio.id]);
    const [destroyStudio] = useStudioDestroy(studio.id);
    const history = useHistory();
    const confirmDelete = useCallback(() => {
      setConfirming(false);
      if (!canDestroyStudio) return;
      destroyStudio({ variables: {} }).then(() => history.push("/studios")).catch((e) => warnOnce("could not delete studio", e));
    }, [destroyStudio, history]);
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-action-row details-edit" }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-primary refract-sr-edit",
        onClick: onEdit
      },
      "Edit"
    ), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-secondary",
        onClick: () => setConfirmingAutoTag(true),
        disabled: busy || !svc.mutateMetadataAutoTag || !!studio.ignore_auto_tag || !AlertModal,
        title: studio.ignore_auto_tag ? "Auto tagging is switched off for this studio" : void 0
      },
      "Auto tag…"
    ), /* @__PURE__ */ R.createElement(
      MoreMenu,
      {
        items: canDestroyStudio ? [{ key: "delete", label: "Delete studio…", danger: true, run: () => setConfirming(true) }] : []
      }
    ), AlertModal ? /* @__PURE__ */ R.createElement(
      AlertModal,
      {
        show: confirming,
        text: "Delete " + studio.name + "?",
        confirmVariant: "danger",
        confirmButtonText: "Delete",
        onConfirm: confirmDelete,
        onCancel: () => setConfirming(false)
      }
    ) : null, AlertModal ? /* @__PURE__ */ R.createElement(
      AlertModal,
      {
        show: confirmingAutoTag,
        text: /* @__PURE__ */ R.createElement(AutoTagWarning, null),
        confirmVariant: "danger",
        onConfirm: autoTag,
        onCancel: () => setConfirmingAutoTag(false)
      }
    ) : null);
  };
  const QualityGroup = ({ studio }) => {
    const RatingSystem = stashComponent("RatingSystem");
    const setRating = useSetRating(studio.id);
    useRatingKeybinds(setRating);
    if (!RatingSystem) return null;
    return /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "quality-group refract-sr-quality" + (studio.rating100 ? "" : " is-unrated")
      },
      /* @__PURE__ */ R.createElement(
        RatingSystem,
        {
          value: studio.rating100,
          onSetRating: setRating,
          clickToRate: true,
          withoutContext: true
        }
      )
    );
  };
  function useSetRating(id) {
    const [updateStudio] = useStudioUpdate();
    return useCallback(
      (value) => {
        updateStudio({ variables: { input: { id, rating100: value } } }).catch(
          (e) => warnOnce("could not set rating", e)
        );
      },
      [id, updateStudio]
    );
  }
  const MoreMenu = ({ items }) => {
    const [open, setOpen] = useState(false);
    const trigger = useRef(null);
    const menu = useRef(null);
    const close = useCallback((restoreFocus) => {
      setOpen(false);
      if (restoreFocus && trigger.current) {
        try {
          trigger.current.focus();
        } catch {
        }
      }
    }, []);
    useEffect(() => {
      if (!open) return void 0;
      const onDown = (e) => {
        const t = e.target;
        if (t && menu.current && menu.current.contains(t)) return;
        if (t && trigger.current && trigger.current.contains(t)) return;
        close(false);
      };
      document.addEventListener("mousedown", onDown, true);
      const first = menu.current && menu.current.querySelector(".refract-sr-menu-item");
      if (first) {
        try {
          first.focus();
        } catch {
        }
      }
      return () => document.removeEventListener("mousedown", onDown, true);
    }, [open, close]);
    const onMenuKey = useCallback(
      (e) => {
        const els = menu.current ? Array.prototype.slice.call(
          menu.current.querySelectorAll(".refract-sr-menu-item")
        ) : [];
        const at = els.indexOf(document.activeElement);
        const focusAt = (i) => {
          if (!els.length) return;
          els[(i % els.length + els.length) % els.length].focus();
        };
        if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          e.stopPropagation();
          close(true);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          focusAt(at + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          focusAt(at - 1);
        } else if (e.key === "Tab") {
          close(false);
        }
      },
      [close]
    );
    if (!items.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "dropdown refract-sr-more-menu" }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        ref: trigger,
        id: "refract-sr-more-trigger",
        className: "btn btn-secondary refract-sr-more-trigger",
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-label": "More actions",
        title: "More actions",
        onClick: () => setOpen((o) => !o),
        onKeyDown: (e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }
      },
      /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", className: "refract-sr-more-dots" }, /* @__PURE__ */ R.createElement("circle", { cx: "5", cy: "12", r: "1.8" }), /* @__PURE__ */ R.createElement("circle", { cx: "12", cy: "12", r: "1.8" }), /* @__PURE__ */ R.createElement("circle", { cx: "19", cy: "12", r: "1.8" }))
    ), /* @__PURE__ */ R.createElement(
      "div",
      {
        ref: menu,
        role: "menu",
        "aria-labelledby": "refract-sr-more-trigger",
        className: "dropdown-menu dropdown-menu-right refract-sr-menu" + (open ? " show" : ""),
        onKeyDown: onMenuKey
      },
      items.map((it) => /* @__PURE__ */ R.createElement(
        "button",
        {
          type: "button",
          key: it.key,
          role: "menuitem",
          tabIndex: -1,
          className: "dropdown-item refract-sr-menu-item" + (it.danger ? " is-danger" : ""),
          onClick: () => {
            close(false);
            it.run();
          }
        },
        it.label
      ))
    ));
  };
  const RatingControl = ({ studio }) => {
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    const chip = useRef(null);
    const opts = useRatingSystemOptions();
    const starsMode = opts.type !== "decimal";
    useEffect(() => {
      if (!open) return void 0;
      const onDown = (e) => {
        const t = e.target;
        if (t && box.current && box.current.contains(t)) return;
        setOpen(false);
      };
      const onKey = (e) => {
        if (e.key !== "Escape" && e.key !== "Esc") return;
        const t = e.target;
        if (!(t && box.current && box.current.contains(t))) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        try {
          if (chip.current) chip.current.focus();
        } catch {
        }
      };
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
      return () => {
        document.removeEventListener("mousedown", onDown, true);
        document.removeEventListener("keydown", onKey, true);
      };
    }, [open]);
    const r = studio.rating100;
    const rated = typeof r === "number" && r > 0;
    const tier = rated ? tierFor(r) : void 0;
    const value = rated ? ratingDisplay(r, starsMode) : "";
    const outOf = starsMode ? " of 5" : " of 10";
    const label = rated ? "Rated " + value + outOf + (tier ? ", " + tier : "") + ". Change rating" : "Not rated. Rate this studio";
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-rating" + (open ? " is-open" : ""), ref: box }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        ref: chip,
        className: "st-tier-chip refract-sr-tier-chip",
        "aria-expanded": open,
        "aria-label": label,
        title: label,
        "data-tier": tier || "",
        "data-rated": rated ? "1" : "0",
        onClick: () => setOpen((o) => !o)
      },
      /* @__PURE__ */ R.createElement("span", { className: "st-tier-name" }, rated ? tier || "Rated" : "Rate"),
      /* @__PURE__ */ R.createElement("span", { className: "st-tier-value", hidden: !value }, value)
    ), /* @__PURE__ */ R.createElement(QualityGroup, { studio }));
  };
  const VALID_TABS = [
    "default",
    "scenes",
    "galleries",
    "images",
    "performers",
    "groups",
    "childstudios"
  ];
  function hasRealLogo(studio) {
    const src = studio.image_path || "";
    return !!src && src.indexOf("default=true") < 0;
  }
  const LogoPlate = ({ studio }) => {
    if (!hasRealLogo(studio)) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-logo" }, /* @__PURE__ */ R.createElement(
      "img",
      {
        className: "refract-sr-logo-img",
        src: studio.image_path || void 0,
        alt: studio.name
      }
    ));
  };
  const HeartIcon = () => /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 512 512", fill: "currentColor", "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ R.createElement("path", { d: "M225.8 468.2l-2.5-2.3L48.1 303.2C17.4 274.7 0 234.7 0 192.8l0-3.3c0-70.4 50-130.8 119.2-144 39.1-7.4 79.4 .9 109.4 22.8c12.2 8.9 19.4 18.2 27.4 28.5 8-10.3 15.3-19.6 27.4-28.5 30-21.9 70.3-30.2 109.4-22.8C462 53.5 512 113.9 512 184.3l0 3.5c0 41.9-17.4 81.9-48.1 110.4L289.6 466c-.8 .8-1.7 1.5-2.5 2.3-9.5 8.8-22 13.7-35 13.7s-25.5-4.9-35-13.7z" }));
  const BoxIcon = () => /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 448 512", fill: "currentColor", "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ R.createElement("path", { d: "M50.7 58.5L0 160l208 0 0-128L93.7 32C75.5 32 58.9 42.3 50.7 58.5zM240 160l208 0L397.3 58.5C389.1 42.3 372.5 32 354.3 32L240 32l0 128zm208 32L0 192 0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-224z" }));
  const NameIcons = ({ studio }) => {
    const ExternalLinkButtons = stashComponent("ExternalLinkButtons");
    const [updateStudio] = useStudioUpdate();
    const [busy, setBusy] = useState(false);
    const write = useCallback(
      (patch, what) => {
        if (!canUpdateStudio) return;
        setBusy(true);
        updateStudio({ variables: { input: { id: studio.id, ...patch } } }).catch((e) => warnOnce("could not set " + what, e)).then(() => setBusy(false));
      },
      [updateStudio, studio.id]
    );
    const favourite = !!studio.favorite;
    const organised = !!studio.organized;
    return /* @__PURE__ */ R.createElement("span", { className: "name-icons refract-sr-name-icons" }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-sr-icon-btn refract-sr-favourite" + (favourite ? " is-on" : ""),
        onClick: () => write({ favorite: !favourite }, "favourite"),
        disabled: !canUpdateStudio,
        "aria-pressed": favourite,
        title: favourite ? "Remove from favourites" : "Add to favourites"
      },
      /* @__PURE__ */ R.createElement(HeartIcon, null)
    ), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-sr-icon-btn refract-sr-organised" + (organised ? " is-on" : ""),
        onClick: () => write({ organized: !organised }, "organised"),
        disabled: !canUpdateStudio || busy,
        "aria-pressed": organised,
        title: organised ? "Mark as not organised" : "Mark as organised"
      },
      /* @__PURE__ */ R.createElement(BoxIcon, null)
    ), ExternalLinkButtons ? /* @__PURE__ */ R.createElement(ExternalLinkButtons, { urls: studio.urls || void 0 }) : null);
  };
  const Band = ({ studio, children, actions }) => {
    const logo = hasRealLogo(studio);
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-band" + (logo ? " has-logo" : "") }, /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-sr-fill",
        style: logo ? {
          "--refract-sr-shot": 'url("' + studio.image_path + '")'
        } : void 0,
        "aria-hidden": "true"
      },
      logo ? /* @__PURE__ */ R.createElement("div", { className: "refract-sr-blur" }) : null,
      /* @__PURE__ */ R.createElement("div", { className: "refract-sr-veil" })
    ), /* @__PURE__ */ R.createElement(LogoPlate, { studio }), /* @__PURE__ */ R.createElement("h2", { className: "refract-sr-title" }, /* @__PURE__ */ R.createElement("span", { className: "refract-sr-name studio-name" }, studio.name), /* @__PURE__ */ R.createElement(NameIcons, { studio })), actions ? /* @__PURE__ */ R.createElement("div", { className: "refract-sr-actions" }, actions) : null, /* @__PURE__ */ R.createElement("div", { className: "refract-sr-head" }, children));
  };
  let resolved;
  function routerLink() {
    if (resolved !== void 0) return resolved;
    const api = pluginApi();
    const lib = api && api.libraries && api.libraries.ReactRouterDOM;
    const link = lib && lib.Link;
    if (link) resolved = link;
    return link || null;
  }
  const RouteLink = ({ to, className, title, children }) => {
    const Link = routerLink();
    if (Link) {
      return /* @__PURE__ */ R.createElement(Link, { to, className, title }, children);
    }
    return /* @__PURE__ */ R.createElement("a", { href: to, className, title }, children);
  };
  const CACHE = {};
  const apollo = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Apollo;
  })();
  const QUERY = `
  query RefractStudioChildCounts($id: ID!) {
    findStudio(id: $id) {
      id
      child_studios { id scene_count }
    }
  }
`;
  const document_ = (() => {
    try {
      if (!apollo || !apollo.gql) return null;
      return apollo.gql([QUERY]);
    } catch {
      return null;
    }
  })();
  const useApolloQuery = apollo && apollo.useQuery;
  function useRankedChildren(studio) {
    const children = studio.child_studios || [];
    const [, force] = useState(0);
    const want = children.length > 0 && !!document_ && !!useApolloQuery;
    const cached = CACHE[studio.id];
    const result = useApolloQuery ? useApolloQuery(document_, { variables: { id: studio.id }, skip: !want || !!cached }) : void 0;
    const rows = result && result.data && result.data.findStudio && result.data.findStudio.child_studios;
    useEffect(() => {
      if (!rows || CACHE[studio.id]) return;
      const map = {};
      rows.forEach((r) => {
        map[r.id] = r.scene_count || 0;
      });
      CACHE[studio.id] = map;
      force((n) => n + 1);
    }, [rows, studio.id]);
    const counts = cached || (rows ? rows.reduce((acc, r) => {
      acc[r.id] = r.scene_count || 0;
      return acc;
    }, {}) : null);
    const kin = children.map((c) => ({
      id: c.id,
      name: c.name || "Untitled",
      count: counts ? counts[c.id] ?? 0 : null
    }));
    if (counts) {
      kin.sort((a, b) => (b.count || 0) - (a.count || 0));
    }
    return kin;
  }
  const CAP = 12;
  const KinGrid = ({ studio }) => {
    const [open, setOpen] = useState(false);
    const kin = useRankedChildren(studio);
    if (!kin.length) return null;
    const shown = open ? kin : kin.slice(0, CAP);
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-kin" + (open ? " is-open" : "") }, /* @__PURE__ */ R.createElement("div", { className: "refract-sr-kin-head" }, /* @__PURE__ */ R.createElement("span", { className: "refract-sr-kin-label" }, "The network, by what each site holds"), kin.length > CAP ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-sr-kin-more",
        "aria-expanded": open,
        onClick: () => setOpen(!open)
      },
      open ? "Show the top " + CAP : "All " + num(kin.length) + " sites"
    ) : null), /* @__PURE__ */ R.createElement("div", { className: "refract-sr-kin-grid" }, shown.map((k) => /* @__PURE__ */ R.createElement(
      RouteLink,
      {
        className: "refract-sr-kin-cell",
        key: k.id,
        to: "/studios/" + k.id
      },
      /* @__PURE__ */ R.createElement("span", { className: "refract-sr-kin-name" }, k.name),
      /* @__PURE__ */ R.createElement("span", { className: "refract-sr-kin-count" }, k.count === null ? "" : num(k.count))
    ))));
  };
  function stashIdList(ids) {
    return /* @__PURE__ */ R.createElement("ul", { className: "refract-sr-sid-list" }, ids.map((s) => /* @__PURE__ */ R.createElement("li", { key: s.endpoint + s.stash_id }, /* @__PURE__ */ R.createElement(
      "a",
      {
        className: "refract-sr-sid-pill",
        href: endpointBase(s.endpoint) + "/studios/" + s.stash_id,
        target: "_blank",
        rel: "noopener noreferrer"
      },
      endpointHost(s.endpoint)
    ), /* @__PURE__ */ R.createElement("span", { className: "refract-sr-sid-value" }, s.stash_id))));
  }
  function buildTiles(studio, wide) {
    const t = [];
    const push = (key, label, value, wide2) => {
      if (value === null || value === void 0 || value === "") return;
      t.push({ key, label, value, wide: wide2 });
    };
    if (studio.parent_studio && studio.parent_studio.id) {
      push(
        "parent",
        "Part of",
        /* @__PURE__ */ R.createElement(
          RouteLink,
          {
            className: "refract-sr-parent-link",
            to: "/studios/" + studio.parent_studio.id
          },
          studio.parent_studio.name
        )
      );
    }
    const o = wide ? studio.o_counter_all ?? studio.o_counter : studio.o_counter;
    if (o) push("o_counter", "O count", num(o));
    if (studio.scene_marker_count) {
      push("markers", "Markers", num(studio.scene_marker_count));
    }
    const ids = (studio.stash_ids || []).filter((s) => s && s.stash_id);
    if (ids.length) push("stash_ids", "Stash IDs", stashIdList(ids));
    return t;
  }
  const ReadoutGrid = ({ studio, wide, extension }) => {
    const tiles = buildTiles(studio, wide);
    if (!tiles.length && !extension) return null;
    const cols = tiles.length <= 1 ? 1 : Math.min(6, Math.max(2, Math.ceil(tiles.length / 2)));
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-grid", "data-refract-cols": cols }, tiles.map((tile) => /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-sr-tile refract-sr-tile-" + tile.key + (tile.wide ? " is-wide" : ""),
        key: tile.key
      },
      /* @__PURE__ */ R.createElement("span", { className: "refract-sr-tile-label" }, tile.label),
      /* @__PURE__ */ R.createElement("span", { className: "refract-sr-tile-value" }, tile.value)
    )), extension);
  };
  const AliasChips = ({ aliases }) => {
    const list = (aliases || []).filter(Boolean);
    if (!list.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-alias" }, list.map((a) => /* @__PURE__ */ R.createElement("span", { className: "refract-sr-alias-chip", key: a }, a)));
  };
  const DetailsRow = ({ details }) => {
    const text = plain(details);
    const [open, setOpen] = useState(false);
    const [clipped, setClipped] = useState(false);
    const bodyRef = useRef(null);
    useLayoutEffect(() => {
      const el = bodyRef.current;
      if (!el) return void 0;
      const measure = () => {
        if (open) return;
        setClipped(el.scrollHeight - el.clientHeight > 1);
      };
      measure();
      if (typeof ResizeObserver === "undefined") return void 0;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }, [text, open]);
    if (!text) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-details" + (open ? " is-open" : "") }, /* @__PURE__ */ R.createElement("span", { className: "refract-sr-tile-label" }, "Description"), /* @__PURE__ */ R.createElement("p", { className: "refract-sr-details-body", ref: bodyRef }, text), clipped || open ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-sr-more",
        onClick: () => setOpen(!open),
        "aria-expanded": open
      },
      open ? "Less" : "More"
    ) : null);
  };
  const TagRow = ({ studio }) => {
    const TagLink = stashComponent("TagLink");
    const tags = studio.tags || [];
    if (!TagLink || !tags.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-tags" }, /* @__PURE__ */ R.createElement("span", { className: "refract-sr-tile-label" }, "Tags"), /* @__PURE__ */ R.createElement("div", { className: "refract-sr-tag-list" }, tags.map((tag) => /* @__PURE__ */ R.createElement(TagLink, { key: tag.id, tag, linkType: "studio" }))));
  };
  function extensionHasContent(customFields) {
    if (!Object.keys(customFields || {}).length) return false;
    return !!stashComponent("CustomFields");
  }
  const ExtensionSlot = ({
    customFields
  }) => {
    const values = customFields || {};
    const signature = useMemo(() => {
      try {
        return JSON.stringify(values);
      } catch {
        return "";
      }
    }, [values]);
    const CustomFields = stashComponent("CustomFields");
    const island = useMemo(() => {
      if (!CustomFields) return null;
      if (!Object.keys(values).length) return null;
      return /* @__PURE__ */ R.createElement(CustomFields, { values, fullWidth: true });
    }, [signature, CustomFields]);
    if (!island) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-extension" }, island);
  };
  const ScopeControl = ({ counts, wide, onChange, actionable, abbreviateCounter }) => {
    const drawn = actionable && !!counts.children && !!counts.all;
    const fmt = (n) => abbreviate(n, abbreviateCounter);
    useEffect(() => {
      if (!drawn) return void 0;
      try {
        if (document.body) document.body.classList.add("refract-sr-has-scope");
      } catch {
      }
      return () => {
        try {
          if (document.body) {
            document.body.classList.remove("refract-sr-has-scope");
          }
        } catch {
        }
      };
    }, [drawn]);
    if (!drawn) return null;
    const sites = counts.children === 1 ? "With its 1 site" : "With all " + fmt(counts.children) + " sites";
    const segments = [
      { seg: "own", label: "This studio", value: counts.own },
      { seg: "all", label: sites, value: counts.all }
    ];
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-scope", "data-scope": wide ? "all" : "own", role: "group" }, segments.map((s) => {
      const on = s.seg === "all" === wide;
      return /* @__PURE__ */ R.createElement(
        "button",
        {
          key: s.seg,
          type: "button",
          className: "refract-sr-scope-seg",
          "data-seg": s.seg,
          "aria-pressed": on,
          onClick: () => onChange(s.seg === "all")
        },
        /* @__PURE__ */ R.createElement("span", { className: "refract-sr-scope-label" }, s.label),
        /* @__PURE__ */ R.createElement("span", { className: "refract-sr-scope-value" }, fmt(s.value), " scenes")
      );
    }));
  };
  const bootstrap = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Bootstrap;
  })();
  function studioFilterHook(studio, wide) {
    return (filter) => {
      const value = { id: studio.id, label: studio.name };
      let c = filter.criteria.find((x) => x.criterionOption.type === "studios");
      if (c) {
        c.value = { items: [value], excluded: [], depth: wide ? -1 : 0 };
        c.modifier = "INCLUDES";
      } else {
        c = filter.makeCriterion("studios");
        c.value = { items: [value], excluded: [], depth: wide ? -1 : 0 };
        c.modifier = "INCLUDES";
        filter.criteria.push(c);
      }
      return filter;
    };
  }
  function childFilterHook(studio) {
    return (filter) => {
      const value = { id: studio.id, label: studio.name };
      let c = filter.criteria.find((x) => x.criterionOption.type === "parents");
      if (!c) {
        c = filter.makeCriterion("parents");
        filter.criteria.push(c);
      }
      c.value = [value];
      c.modifier = "INCLUDES_ALL";
      return filter;
    };
  }
  const StudioTabs = ({ studio, tabKey, wide, abbreviateCounter }) => {
    const history = useHistory();
    const TabTitleCounter = stashComponent("TabTitleCounter");
    const pick = (own, all) => (wide ? all ?? own : own) ?? 0;
    const counts = {
      scenes: pick(studio.scene_count, studio.scene_count_all),
      galleries: pick(studio.gallery_count, studio.gallery_count_all),
      images: pick(studio.image_count, studio.image_count_all),
      performers: pick(studio.performer_count, studio.performer_count_all),
      groups: pick(studio.group_count, studio.group_count_all),
      children: (studio.child_studios || []).length
    };
    const fallbackTab = useMemo(() => defaultTab(counts), [
      counts.scenes,
      counts.galleries,
      counts.images,
      counts.performers,
      counts.groups,
      counts.children
    ]);
    const setTabKey = useCallback(
      (next) => {
        const key = next || fallbackTab;
        if (key === tabKey) return;
        if (VALID_TABS.indexOf(key) < 0) return;
        history.replace("/studios/" + studio.id + "/" + key);
      },
      [fallbackTab, tabKey, history, studio.id]
    );
    useEffect(() => {
      if (!tabKey || tabKey === "default") setTabKey(fallbackTab);
    }, [setTabKey, fallbackTab, tabKey]);
    usePageKeybinds({
      c: () => setTabKey("scenes"),
      g: () => setTabKey("galleries"),
      m: () => setTabKey("groups")
    });
    const contentHook = useMemo(() => studioFilterHook(studio, wide), [studio, wide]);
    const kinHook = useMemo(() => childFilterHook(studio), [studio]);
    const panels = [
      { key: "scenes", component: "FilteredSceneList", messageID: "scenes", count: counts.scenes, view: "studio_scenes" },
      { key: "galleries", component: "FilteredGalleryList", messageID: "galleries", count: counts.galleries, view: "studio_galleries" },
      { key: "images", component: "FilteredImageList", messageID: "images", count: counts.images, view: "studio_images" },
      { key: "performers", component: "FilteredPerformerList", messageID: "performers", count: counts.performers, view: "studio_performers" },
      { key: "groups", component: "FilteredGroupList", messageID: "groups", count: counts.groups, view: "studio_groups" },
      { key: "childstudios", component: "FilteredStudioList", messageID: "subsidiary_studios", count: counts.children, view: "studio_children", extra: { fromParent: true } }
    ];
    const Tabs = bootstrap && bootstrap.Tabs;
    const Tab = bootstrap && bootstrap.Tab;
    if (!Tabs || !Tab) return null;
    const active = tabKey && tabKey !== "default" ? tabKey : fallbackTab;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-sr-tabs detail-body" }, /* @__PURE__ */ R.createElement("div", { className: "studio-body" }, /* @__PURE__ */ R.createElement("div", { className: "studio-tabs" }, /* @__PURE__ */ R.createElement(
      Tabs,
      {
        id: "studio-tabs",
        mountOnEnter: true,
        unmountOnExit: true,
        activeKey: active,
        onSelect: setTabKey
      },
      panels.map((p) => {
        const List = stashComponent(p.component);
        return /* @__PURE__ */ R.createElement(
          Tab,
          {
            key: p.key,
            eventKey: p.key,
            title: TabTitleCounter ? /* @__PURE__ */ R.createElement(
              TabTitleCounter,
              {
                messageID: p.messageID,
                count: p.count,
                abbreviateCounter
              }
            ) : p.messageID
          },
          List ? /* @__PURE__ */ R.createElement(
            List,
            {
              filterHook: p.key === "childstudios" ? kinHook : contentHook,
              alterQuery: active === p.key,
              view: p.view,
              ...p.extra || {}
            }
          ) : null
        );
      })
    ))));
  };
  const SWITCH = "#showSubContent";
  function readSwitch() {
    try {
      const el = document.querySelector(SWITCH);
      return el ? !!el.checked : null;
    } catch {
      return null;
    }
  }
  function useScope(ownTabs, ui) {
    const [wide, setLocal] = useState(() => !!ui.showChildStudioContent);
    const [pending, setPending] = useState(null);
    useEffect(() => {
      if (ownTabs) return void 0;
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        if (pending !== null) return;
        const v = readSwitch();
        if (v !== null) {
          window.clearInterval(t);
          setLocal((prev) => prev === v ? prev : v);
        } else if (tries > 20) {
          window.clearInterval(t);
        }
      }, 100);
      return () => window.clearInterval(t);
    }, [ownTabs, pending]);
    useEffect(() => {
      if (ownTabs) return void 0;
      const onChange = (e) => {
        const t = e.target;
        if (!t || t.id !== "showSubContent") return;
        setLocal(!!t.checked);
      };
      document.addEventListener("change", onChange, true);
      return () => document.removeEventListener("change", onChange, true);
    }, [ownTabs]);
    const setWide = useCallback(
      (v) => {
        if (ownTabs) {
          setLocal(v);
          return;
        }
        try {
          const el = document.querySelector(SWITCH);
          if (!el) return;
          if (el.checked !== v) el.click();
          setLocal(v);
        } catch {
        }
      },
      [ownTabs]
    );
    const requestWide = useCallback(
      (v) => {
        if (ownTabs) {
          setLocal(v);
          return;
        }
        try {
          const el = document.querySelector(SWITCH);
          if (el) {
            if (el.checked !== v) el.click();
            setLocal(v);
            return;
          }
        } catch {
        }
        setPending(v);
      },
      [ownTabs]
    );
    useEffect(() => {
      if (ownTabs || pending === null) return void 0;
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        let el = null;
        try {
          el = document.querySelector(SWITCH);
        } catch {
          el = null;
        }
        if (el) {
          window.clearInterval(t);
          if (el.checked !== pending) el.click();
          setLocal(pending);
          setPending(null);
        } else if (tries > 40) {
          window.clearInterval(t);
          setPending(null);
        }
      }, 100);
      return () => window.clearInterval(t);
    }, [ownTabs, pending]);
    return { wide, setWide, requestWide, owned: ownTabs };
  }
  class RefractErrorBoundary extends R.Component {
    constructor(props) {
      super(props);
      this.state = { tripped: false };
    }
    static getDerivedStateFromError() {
      return { tripped: true };
    }
    componentDidCatch(error) {
      warnOnce("owned page threw, handing back to Stash's page", error);
      if (this.props.onTrip) {
        try {
          this.props.onTrip();
        } catch {
        }
      }
    }
    render() {
      if (this.state.tripped) return this.props.fallback;
      return this.props.children;
    }
  }
  const OWN_STUDIO_PAGE_KEY = "refract.ownStudioPage";
  function readSetting(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function ownStudioPageEnabled() {
    return readSetting(OWN_STUDIO_PAGE_KEY) !== "0";
  }
  const REQUIRED_COMPONENTS = [
    "RatingSystem",
    "TagLink",
    "ExternalLinkButtons",
    "FilteredSceneList",
    "FilteredGalleryList",
    "FilteredImageList",
    "FilteredPerformerList",
    "FilteredGroupList",
    "FilteredStudioList"
  ];
  const OWNED_BODY_CLASS = "refract-owned-studio";
  function useCapability() {
    const [capable, setCapable] = useState(() => haveComponents(REQUIRED_COMPONENTS));
    useEffect(() => {
      if (capable) return void 0;
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        if (haveComponents(REQUIRED_COMPONENTS)) {
          window.clearInterval(t);
          setCapable(true);
        } else if (tries > 60) {
          window.clearInterval(t);
          warnOnce(
            "standing down: this Stash is missing one of " + REQUIRED_COMPONENTS.join(", ")
          );
        }
      }, 50);
      return () => window.clearInterval(t);
    }, [capable]);
    return capable;
  }
  function useOwned() {
    const capable = useCapability();
    return ownStudioPageEnabled() && capable;
  }
  const StudioRoute = ({
    studio,
    tabKey,
    fallback,
    onEdit,
    rootId,
    ownTabs
  }) => {
    const [handedBack, setHandedBack] = useState(false);
    useEffect(() => {
      announceOnce("owns /studios/" + studio.id);
    }, [studio.id]);
    if (handedBack) return /* @__PURE__ */ R.createElement(R.Fragment, null, fallback);
    return /* @__PURE__ */ R.createElement(RefractErrorBoundary, { fallback, onTrip: () => setHandedBack(true) }, /* @__PURE__ */ R.createElement(
      StudioView,
      {
        studio,
        tabKey,
        onEdit,
        rootId,
        ownTabs
      }
    ));
  };
  const StudioView = ({ studio, tabKey, onEdit, rootId, ownTabs }) => {
    const ui = useUiConfig();
    const scope = useScope(ownTabs, ui);
    useEffect(() => {
      const was = document.title;
      document.title = studio.name;
      return () => {
        document.title = was;
      };
    }, [studio.name]);
    const [updateStudio] = useStudioUpdate();
    const toggleFavourite = useCallback(() => {
      if (!canUpdateStudio) return;
      updateStudio({
        variables: { input: { id: studio.id, favorite: !studio.favorite } }
      }).catch((e) => warnOnce("could not set favourite", e));
    }, [updateStudio, studio.id, studio.favorite]);
    usePageKeybinds({ e: onEdit, f: toggleFavourite });
    const scopeCounts = useMemo(
      () => ({
        own: studio.scene_count || 0,
        all: studio.scene_count_all ?? studio.scene_count ?? 0,
        children: (studio.child_studios || []).length
      }),
      [studio]
    );
    const tabCounts = useMemo(
      () => ({
        narrow: {
          scenes: studio.scene_count || 0,
          galleries: studio.gallery_count || 0,
          images: studio.image_count || 0,
          performers: studio.performer_count || 0,
          groups: studio.group_count || 0
        },
        wide: {
          scenes: studio.scene_count_all ?? studio.scene_count ?? 0,
          galleries: studio.gallery_count_all ?? studio.gallery_count ?? 0,
          images: studio.image_count_all ?? studio.image_count ?? 0,
          performers: studio.performer_count_all ?? studio.performer_count ?? 0,
          groups: studio.group_count_all ?? studio.group_count ?? 0
        }
      }),
      [studio]
    );
    const strandedWide = useMemo(() => {
      const n = tabCounts.narrow;
      const w = tabCounts.wide;
      const narrowEmpty = !n.scenes && !n.galleries && !n.images && !n.performers && !n.groups;
      const wideHasSomething = !!w.scenes || !!w.galleries || !!w.images || !!w.performers || !!w.groups;
      return narrowEmpty && wideHasSomething;
    }, [tabCounts]);
    const activeTab = useMemo(() => {
      if (tabKey && tabKey !== "default" && VALID_TABS.indexOf(tabKey) >= 0) {
        return tabKey;
      }
      const pick = (own, all) => (scope.wide ? all ?? own : own) || 0;
      return defaultTab({
        scenes: pick(studio.scene_count, studio.scene_count_all),
        galleries: pick(studio.gallery_count, studio.gallery_count_all),
        images: pick(studio.image_count, studio.image_count_all),
        performers: pick(studio.performer_count, studio.performer_count_all),
        groups: pick(studio.group_count, studio.group_count_all),
        children: scopeCounts.children
      });
    }, [tabKey, studio, scope.wide, scopeCounts.children]);
    const history = useHistory();
    const onScopeChange = useCallback(
      (v) => {
        if (!v || activeTab !== "childstudios") {
          scope.setWide(v);
          return;
        }
        const w = tabCounts.wide;
        const to = defaultTab({
          scenes: w.scenes,
          galleries: w.galleries,
          images: w.images,
          performers: w.performers,
          groups: w.groups,
          children: scopeCounts.children
        });
        scope.requestWide(true);
        history.replace("/studios/" + studio.id + "/" + to);
      },
      [scope, activeTab, tabCounts, scopeCounts.children, history, studio.id]
    );
    return /* @__PURE__ */ R.createElement("div", { id: rootId, className: "refract-sr" }, /* @__PURE__ */ R.createElement(Band, { studio, actions: /* @__PURE__ */ R.createElement(ActionBar, { studio, onEdit }) }, /* @__PURE__ */ R.createElement(AliasChips, { aliases: studio.aliases }), /* @__PURE__ */ R.createElement(RatingControl, { studio }), /* @__PURE__ */ R.createElement(
      ScopeControl,
      {
        counts: scopeCounts,
        wide: scope.wide,
        onChange: onScopeChange,
        actionable: activeTab !== "childstudios" || strandedWide,
        abbreviateCounter: !!ui.abbreviateCounters
      }
    ), /* @__PURE__ */ R.createElement(
      ReadoutGrid,
      {
        studio,
        wide: scope.wide,
        extension: extensionHasContent(studio.custom_fields) ? /* @__PURE__ */ R.createElement(ExtensionSlot, { customFields: studio.custom_fields }) : null
      }
    ), /* @__PURE__ */ R.createElement(DetailsRow, { details: studio.details }), /* @__PURE__ */ R.createElement(TagRow, { studio }), activeTab === "childstudios" ? null : /* @__PURE__ */ R.createElement(KinGrid, { studio })), ownTabs ? /* @__PURE__ */ R.createElement(
      StudioTabs,
      {
        studio,
        tabKey,
        wide: scope.wide,
        abbreviateCounter: !!ui.abbreviateCounters
      }
    ) : null);
  };
  const EDIT_SELECTOR = ".detail-header.edit";
  function inEditMode() {
    try {
      return !!document.querySelector(EDIT_SELECTOR);
    } catch {
      return false;
    }
  }
  function useReturnFromEdit(active, done) {
    useEffect(() => {
      if (!active) return void 0;
      if (typeof MutationObserver === "undefined") return void 0;
      let seen = inEditMode();
      let finished = false;
      const check = () => {
        if (finished) return;
        if (inEditMode()) {
          seen = true;
          return;
        }
        if (!seen) return;
        finished = true;
        observer.disconnect();
        done();
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      return () => {
        finished = true;
        observer.disconnect();
      };
    }, [active, done]);
  }
  function stashEditButton() {
    try {
      return document.querySelector(
        "#studio-page .detail-header .details-edit .btn.edit"
      );
    } catch {
      return null;
    }
  }
  function openStashEdit() {
    const btn = stashEditButton();
    if (btn) {
      btn.click();
      return true;
    }
    const mt = mousetrap();
    if (!mt) return false;
    try {
      mt.trigger("e");
    } catch (e) {
      warnOnce("could not open Stash's edit form", e);
    }
    return false;
  }
  function useTabFromPath(id) {
    const path = useLocationPath();
    const m = new RegExp("^/studios/" + id + "/([a-z]+)").exec(path || "");
    if (!m) return void 0;
    const tab = m[1];
    return VALID_TABS.indexOf(tab) >= 0 ? tab : void 0;
  }
  const StudioPanelHost = ({ next: Next, ...props }) => {
    const owned = useOwned();
    const pageDoorOpen = !!stashComponent("StudioPage");
    const tabKey = useTabFromPath(props.studio.id);
    const openEdit = useCallback(openStashEdit, []);
    const stash = /* @__PURE__ */ R.createElement(Next, { ...props });
    if (pageDoorOpen || !owned) return stash;
    return /* @__PURE__ */ R.createElement(PortalHost, { active: true, bodyClass: OWNED_BODY_CLASS }, /* @__PURE__ */ R.createElement(
      StudioRoute,
      {
        studio: props.studio,
        tabKey,
        fallback: stash,
        onEdit: openEdit,
        ownTabs: false
      }
    ));
  };
  const StudioPageOverride = ({ next: Next, studio, tabKey }) => {
    const owned = useOwned();
    const [mode, setMode] = useState("view");
    const openEdit = useCallback(() => setMode("stash"), []);
    useEffect(() => {
      if (mode !== "stash") return void 0;
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        if (openStashEdit() || tries > 20) window.clearInterval(t);
      }, 50);
      return () => window.clearInterval(t);
    }, [mode]);
    const returnToView = useCallback(() => setMode("view"), []);
    useReturnFromEdit(mode !== "view", returnToView);
    const active = owned && mode === "view";
    useEffect(() => {
      if (!active) return;
      announceOnce("mounted through StudioPage");
    }, [active]);
    useEffect(() => {
      if (!active) return void 0;
      try {
        if (document.body) document.body.classList.add(OWNED_BODY_CLASS);
      } catch {
      }
      return () => {
        try {
          if (document.body) document.body.classList.remove(OWNED_BODY_CLASS);
        } catch {
        }
      };
    }, [active]);
    const stash = /* @__PURE__ */ R.createElement(Next, { studio, tabKey });
    if (!active) return stash;
    return /* @__PURE__ */ R.createElement(
      StudioRoute,
      {
        studio,
        tabKey,
        fallback: stash,
        onEdit: openEdit,
        rootId: "studio-page",
        ownTabs: true
      }
    );
  };
  const STUDIO_ROUTE = /^\/studios\/\d+/;
  function noDoorHere() {
    if (!ownStudioPageEnabled()) return false;
    if (!STUDIO_ROUTE.test(window.location.pathname)) return false;
    if (stashComponent("StudioPage") || stashComponent("StudioDetailsPanel")) return false;
    return haveComponents(REQUIRED_COMPONENTS);
  }
  function checkDoors() {
    let tries = 0;
    const t = window.setInterval(() => {
      tries += 1;
      if (!STUDIO_ROUTE.test(window.location.pathname) || tries > 40) {
        window.clearInterval(t);
        return;
      }
      if (stashComponent("StudioPage") || stashComponent("StudioDetailsPanel")) {
        window.clearInterval(t);
        return;
      }
      if (noDoorHere()) {
        window.clearInterval(t);
        warnOnce(
          "neither StudioPage nor StudioDetailsPanel is a patch point on this Stash, so the theme's patched studio page is in use."
        );
      }
    }, 100);
  }
  function watchForNoDoor() {
    const api = pluginApi();
    const ev = api && api.Event;
    if (ev && typeof ev.addEventListener === "function") {
      try {
        ev.addEventListener("stash:location", checkDoors);
      } catch {
      }
    }
    checkDoors();
  }
  function register() {
    const api = pluginApi();
    if (!api || !api.patch || typeof api.patch.instead !== "function" || !api.React) {
      window.setTimeout(register, 100);
      return;
    }
    try {
      api.patch.instead("StudioPage", function(...args) {
        const next = args.pop();
        const props = args[0];
        if (!props || !props.studio) {
          return R.createElement(next, props);
        }
        return R.createElement(StudioPageOverride, {
          studio: props.studio,
          tabKey: props.tabKey,
          next
        });
      });
    } catch (e) {
      warnOnce("could not patch StudioPage", e);
    }
    try {
      api.patch.instead("StudioDetailsPanel", function(...args) {
        const next = args.pop();
        const props = args[0];
        if (!props || !props.studio) {
          return R.createElement(next, props);
        }
        return R.createElement(StudioPanelHost, { ...props, next });
      });
    } catch (e) {
      warnOnce("could not patch StudioDetailsPanel", e);
    }
    watchForNoDoor();
  }
  register();
})();
