(function() {
  "use strict";
  const host$1 = window;
  const React = host$1.PluginApi && host$1.PluginApi.React;
  if (!React) {
    throw new Error("refract-pages: PluginApi.React is not available");
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
    throw new Error("refract-pages: PluginApi.ReactDOM is not available");
  }
  const D = ReactDOM;
  const createPortal = D.createPortal;
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
      console.info("[refract-pages] " + what);
    } catch {
    }
  }
  function warnOnce(what, err) {
    if (announced["warn:" + what]) return;
    announced["warn:" + what] = true;
    try {
      if (err === void 0) console.warn("[refract-pages] " + what);
      else console.warn("[refract-pages] " + what, err);
    } catch {
    }
  }
  const cache = {};
  const pending = {};
  function loadPanel(name) {
    if (cache[name]) return Promise.resolve(cache[name]);
    const existing = pending[name];
    if (existing) return existing;
    const api = pluginApi();
    const loader = api && api.loadableComponents && api.loadableComponents[name];
    if (typeof loader !== "function") {
      warnOnce("no loadable component named " + name);
      return Promise.resolve(void 0);
    }
    const p = Promise.resolve().then(() => loader()).then((mod) => {
      const m = mod;
      const c = m && (m.default || m[name]);
      if (!c) warnOnce("loadable " + name + " has no component export");
      if (c) cache[name] = c;
      return c;
    }).catch((e) => {
      warnOnce("could not load " + name, e);
      return void 0;
    });
    pending[name] = p;
    return p;
  }
  function useLoadable(name) {
    const [comp, setComp] = useState(() => cache[name]);
    useEffect(() => {
      if (cache[name]) {
        setComp(() => cache[name]);
        return void 0;
      }
      let live = true;
      loadPanel(name).then((c) => {
        if (live && c) setComp(() => c);
      });
      return () => {
        live = false;
      };
    }, [name]);
    return comp;
  }
  function stashService() {
    const api = pluginApi();
    return api && api.utils && api.utils.StashService || {};
  }
  const performerUpdateHook = stashService().usePerformerUpdate;
  const noopTuple = [
    () => Promise.reject(new Error("refract-pages: mutation unavailable")),
    void 0
  ];
  const performerDestroyHook = stashService().usePerformerDestroy;
  const canUpdatePerformer = !!performerUpdateHook;
  const canDestroyPerformer = !!performerDestroyHook;
  function usePerformerUpdate() {
    if (!performerUpdateHook) return noopTuple;
    return performerUpdateHook();
  }
  function usePerformerDestroy() {
    if (!performerDestroyHook) {
      return noopTuple;
    }
    return performerDestroyHook();
  }
  const routerLibrary = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.ReactRouterDOM;
  })();
  const useRouterHistory = routerLibrary && routerLibrary.useHistory;
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
  const configurationHook$1 = stashService().useConfiguration;
  function useStashBoxes() {
    const result = configurationHook$1 ? configurationHook$1() : void 0;
    const data = result && result.data;
    const general = data && data.configuration && data.configuration.general;
    return general && general.stashBoxes || [];
  }
  function useRatingSystemOptions() {
    const result = configurationHook$1 ? configurationHook$1() : void 0;
    const data = result && result.data;
    const ui = data && data.configuration && data.configuration.ui;
    return ui && ui.ratingSystemOptions || {};
  }
  const TRIGGER_ID = "refract-pr-more-trigger";
  const MoreActions = ({ performer, onHandOver, onDelete }) => {
    const [open, setOpen] = useState(false);
    const [focusEnd, setFocusEnd] = useState("first");
    const [mergeOpen, setMergeOpen] = useState(false);
    const [draftOpen, setDraftOpen] = useState(false);
    const trigger = useRef(null);
    const menu = useRef(null);
    const history = useHistory();
    const boxes = useStashBoxes();
    const MergeModal = stashComponent("PerformerMergeModal");
    const SubmitDraft = useLoadable("SubmitStashBoxDraft");
    const closeMerge = useCallback(
      (mergedID) => {
        setMergeOpen(false);
        if (mergedID !== void 0 && mergedID !== performer.id) {
          history.replace("/performers/" + mergedID);
        }
      },
      [history, performer.id]
    );
    const items = useMemo(() => {
      const list = [];
      list.push({
        key: "merge",
        label: "Merge…",
        run: MergeModal ? () => setMergeOpen(true) : () => onHandOver("merge")
      });
      if (boxes.length > 0 && SubmitDraft) {
        list.push({
          key: "draft",
          label: "Submit to Stash-Box",
          run: () => setDraftOpen(true)
        });
      }
      if (onDelete) {
        list.push({
          key: "delete",
          label: "Delete performer…",
          run: onDelete,
          danger: true
        });
      }
      return list;
    }, [MergeModal, SubmitDraft, boxes.length, onHandOver, onDelete]);
    const close = useCallback((restoreFocus) => {
      setOpen(false);
      if (!restoreFocus) return;
      const el = trigger.current;
      if (el) {
        try {
          el.focus();
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
      return () => document.removeEventListener("mousedown", onDown, true);
    }, [open, close]);
    const onMenuKey = useCallback(
      (e) => {
        const els = menu.current ? Array.prototype.slice.call(
          menu.current.querySelectorAll(".refract-pr-menu-item")
        ) : [];
        const at = els.indexOf(document.activeElement);
        const focusAt = (i) => {
          if (!els.length) return;
          const n = (i % els.length + els.length) % els.length;
          try {
            els[n].focus();
          } catch {
          }
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
        } else if (e.key === "Home") {
          e.preventDefault();
          focusAt(0);
        } else if (e.key === "End") {
          e.preventDefault();
          focusAt(els.length - 1);
        } else if (e.key === "Tab") {
          close(false);
        }
      },
      [close]
    );
    const onTriggerKey = useCallback((e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusEnd("first");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        setFocusEnd("last");
      } else if (e.key === "Escape" || e.key === "Esc") {
        setOpen(false);
      }
    }, []);
    useEffect(() => {
      if (!open) return;
      const els = menu.current ? Array.prototype.slice.call(
        menu.current.querySelectorAll(".refract-pr-menu-item")
      ) : [];
      const el = focusEnd === "last" ? els[els.length - 1] : els[0];
      if (el) {
        try {
          el.focus();
        } catch {
        }
      }
    }, [open, focusEnd]);
    const runItem = useCallback(
      (item) => {
        close(false);
        try {
          item.run();
        } catch (e) {
          warnOnce("could not run " + item.key, e);
        }
      },
      [close]
    );
    return (
      /* `show-carat` is Stash's own opt-in, not a class of ours:
         `_theme.scss` turns Bootstrap's caret OFF with
         `:not(.show-carat) > .dropdown-toggle::after { content: none }`
         and every toggle that wants one adds it to the parent. Measured
         without it, the trigger was 95.16 wide with `content: "none"`
         on its own `::after`, so it read as a button that acts rather
         than one that discloses, which is the whole complaint this
         lane exists to answer. With it, the caret is Stash's, sized by
         the text box and coloured by `currentColor`, which is 6.12's
         rule for free. */
      /* @__PURE__ */ R.createElement("div", { className: "dropdown refract-pr-more-menu" }, /* @__PURE__ */ R.createElement(
        "button",
        {
          type: "button",
          id: TRIGGER_ID,
          ref: trigger,
          className: "btn btn-secondary refract-pr-more-trigger",
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-label": "More actions",
          title: "More actions",
          onClick: () => {
            setFocusEnd("first");
            setOpen((o) => !o);
          },
          onKeyDown: onTriggerKey
        },
        /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", className: "refract-pr-more-dots" }, /* @__PURE__ */ R.createElement("circle", { cx: "5", cy: "12", r: "1.8" }), /* @__PURE__ */ R.createElement("circle", { cx: "12", cy: "12", r: "1.8" }), /* @__PURE__ */ R.createElement("circle", { cx: "19", cy: "12", r: "1.8" }))
      ), /* @__PURE__ */ R.createElement(
        "div",
        {
          ref: menu,
          role: "menu",
          "aria-labelledby": TRIGGER_ID,
          className: "dropdown-menu dropdown-menu-right refract-pr-menu" + (open ? " show" : ""),
          onKeyDown: onMenuKey
        },
        items.map((it) => /* @__PURE__ */ R.createElement(R.Fragment, { key: it.key }, it.danger ? /* @__PURE__ */ R.createElement("div", { className: "dropdown-divider", role: "separator" }) : null, /* @__PURE__ */ R.createElement(
          "button",
          {
            type: "button",
            role: "menuitem",
            tabIndex: -1,
            className: "dropdown-item refract-pr-menu-item" + (it.danger ? " is-danger" : ""),
            onClick: () => runItem(it)
          },
          it.label
        )))
      ), MergeModal ? /* @__PURE__ */ R.createElement(
        MergeModal,
        {
          show: mergeOpen,
          onClose: closeMerge,
          performers: [performer]
        }
      ) : null, SubmitDraft ? /* @__PURE__ */ R.createElement(
        SubmitDraft,
        {
          type: "performer",
          boxes,
          entity: performer,
          show: draftOpen,
          onHide: () => setDraftOpen(false)
        }
      ) : null)
    );
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
  const ActionBar = ({ performer, onEdit, onHandOver }) => {
    const [confirming, setConfirming] = useState(false);
    const [confirmingAutoTag, setConfirmingAutoTag] = useState(false);
    const [busy, setBusy] = useState(false);
    const svc = stashService();
    const AlertModal = stashComponent("AlertModal");
    const autoTag = useCallback(() => {
      setConfirmingAutoTag(false);
      const fn = svc.mutateMetadataAutoTag;
      if (!fn) return;
      setBusy(true);
      fn({ performers: [performer.id] }).catch((e) => warnOnce("could not start auto tagging", e)).then(() => setBusy(false));
    }, [svc, performer.id]);
    const [destroyPerformer] = usePerformerDestroy();
    const history = useHistory();
    const anyConfirm = confirming || confirmingAutoTag;
    useEffect(() => {
      if (!anyConfirm) return void 0;
      const onKey = (e) => {
        if (e.key !== "Escape" && e.key !== "Esc") return;
        e.preventDefault();
        e.stopPropagation();
        setConfirming(false);
        setConfirmingAutoTag(false);
      };
      document.addEventListener("keydown", onKey, true);
      return () => document.removeEventListener("keydown", onKey, true);
    }, [anyConfirm]);
    useCancelFocus(anyConfirm);
    const confirmDelete = useCallback(() => {
      setConfirming(false);
      if (!canDestroyPerformer) return;
      destroyPerformer({ variables: { id: performer.id } }).then(() => history.push("/performers")).catch((e) => warnOnce("could not delete performer", e));
    }, [destroyPerformer, history, performer.id]);
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-action-row" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "btn btn-primary refract-pr-edit", onClick: onEdit }, "Edit"), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-secondary",
        onClick: () => setConfirmingAutoTag(true),
        disabled: busy || !svc.mutateMetadataAutoTag || !!performer.ignore_auto_tag || !AlertModal,
        title: performer.ignore_auto_tag ? "Auto tagging is switched off for this performer" : void 0
      },
      "Auto tag…"
    ), /* @__PURE__ */ R.createElement(
      MoreActions,
      {
        performer,
        onHandOver,
        onDelete: canDestroyPerformer ? () => setConfirming(true) : void 0
      }
    ), /* @__PURE__ */ R.createElement("span", { className: "refract-pr-action-ext details-edit" }), AlertModal ? /* @__PURE__ */ R.createElement(
      AlertModal,
      {
        show: confirming,
        text: "Delete " + performer.name + "?",
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
  function observeDeferred(el, measure) {
    if (typeof ResizeObserver === "undefined") return () => void 0;
    let raf = 0;
    let alive = true;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!alive) return;
        measure();
      });
    });
    ro.observe(el);
    return () => {
      alive = false;
      if (raf) window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }
  const AliasChips = ({ aliases }) => {
    const [open, setOpen] = useState(false);
    const [clipped, setClipped] = useState(false);
    const listRef = useRef(null);
    useLayoutEffect(() => {
      const el = listRef.current;
      const row = el ? el.parentElement : null;
      if (!el || !row) return void 0;
      const measure = () => {
        const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
        let needed = 0;
        for (let i = 0; i < el.children.length; i++) {
          needed += el.children[i].getBoundingClientRect().width;
          if (i) needed += gap;
        }
        const rcs = getComputedStyle(row);
        const avail = row.getBoundingClientRect().width - (parseFloat(rcs.paddingLeft) || 0) - (parseFloat(rcs.paddingRight) || 0);
        const next = needed - avail > 1;
        setClipped((prev) => prev === next ? prev : next);
      };
      measure();
      return observeDeferred(row, measure);
    }, [aliases, open]);
    if (!aliases.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-alias" + (open ? " is-open" : "") }, /* @__PURE__ */ R.createElement("div", { className: "refract-pr-alias-list", ref: listRef }, aliases.map((a) => /* @__PURE__ */ R.createElement("span", { className: "refract-pr-alias-chip", key: a }, a))), (clipped || open) && /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-pr-alias-more",
        onClick: () => setOpen(!open),
        "aria-expanded": open
      },
      open ? "Show fewer" : "Show all " + aliases.length
    ));
  };
  const HeartIcon = () => /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 512 512", fill: "currentColor", "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ R.createElement("path", { d: "M225.8 468.2l-2.5-2.3L48.1 303.2C17.4 274.7 0 234.7 0 192.8l0-3.3c0-70.4 50-130.8 119.2-144 39.1-7.4 79.4 .9 109.4 22.8c12.2 8.9 19.4 18.2 27.4 28.5 8-10.3 15.3-19.6 27.4-28.5 30-21.9 70.3-30.2 109.4-22.8C462 53.5 512 113.9 512 184.3l0 3.5c0 41.9-17.4 81.9-48.1 110.4L289.6 466c-.8 .8-1.7 1.5-2.5 2.3-9.5 8.8-22 13.7-35 13.7s-25.5-4.9-35-13.7z" }));
  const PhotoFlipIcon = () => /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ R.createElement("rect", { x: "2", y: "5", width: "8", height: "14", rx: "1.5", fill: "currentColor" }), /* @__PURE__ */ R.createElement(
    "rect",
    {
      x: "14",
      y: "5",
      width: "8",
      height: "14",
      rx: "1.5",
      stroke: "currentColor",
      strokeWidth: "1.6",
      opacity: "0.6"
    }
  ), /* @__PURE__ */ R.createElement("path", { d: "M12 3v18", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }));
  const FavouriteButton = ({ id, favourite }) => {
    const [updatePerformer] = usePerformerUpdate();
    const toggle = useCallback(() => {
      if (!canUpdatePerformer) return;
      updatePerformer({ variables: { input: { id, favorite: !favourite } } }).catch(
        (e) => warnOnce("could not set favourite", e)
      );
    }, [id, favourite, updatePerformer]);
    return /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-pr-icon-btn refract-pr-favourite" + (favourite ? " is-on" : ""),
        onClick: toggle,
        disabled: !canUpdatePerformer,
        "aria-pressed": favourite,
        title: favourite ? "Remove from favourites" : "Add to favourites"
      },
      /* @__PURE__ */ R.createElement(HeartIcon, null)
    );
  };
  const OWN_PERFORMER_PAGE_KEY = "refract.ownPerformerPage";
  function readSetting(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function ownPerformerPageEnabled() {
    return readSetting(OWN_PERFORMER_PAGE_KEY) !== "0";
  }
  const BACK_FIELD = "refract_back";
  const BACK_SRC_KEY = "refract.cbSrc";
  function backSourcePref() {
    const v = readSetting(BACK_SRC_KEY);
    return v === "portrait" || v === "photo" ? v : "scene";
  }
  function backOverride(cf) {
    try {
      const raw = cf ? cf[BACK_FIELD] : null;
      if (!raw) return null;
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      const path = o && typeof o === "object" ? o.path : null;
      return typeof path === "string" && path ? path : null;
    } catch {
      return null;
    }
  }
  const BACK_QUERY = `
  query RefractPerformerBackPhoto($id: ID!) {
    findScenes(
      scene_filter: { performers: { value: [$id], modifier: INCLUDES } }
      filter: { per_page: 1, sort: "rating", direction: DESC }
    ) { scenes { id paths { screenshot } } }
    findImages(
      image_filter: { performers: { value: [$id], modifier: INCLUDES } }
      filter: { per_page: 1, sort: "rating", direction: DESC }
    ) { images { id paths { thumbnail } } }
  }
`;
  const apollo$1 = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Apollo;
  })();
  const backDocument = (() => {
    try {
      if (!apollo$1 || !apollo$1.gql) return null;
      return apollo$1.gql([BACK_QUERY]);
    } catch {
      return null;
    }
  })();
  const useApolloQuery$1 = apollo$1 && apollo$1.useQuery;
  function useBackPhoto(performer, armed) {
    const portrait = performer.image_path || null;
    const override = backOverride(performer.custom_fields);
    const pref = backSourcePref();
    const needsQuery = !override && pref !== "portrait" && !!backDocument && !!useApolloQuery$1;
    const result = useApolloQuery$1 ? useApolloQuery$1(backDocument, {
      variables: { id: performer.id },
      skip: !needsQuery || !armed
    }) : void 0;
    if (override) return { url: override, resolved: true, needsQuery: false };
    if (!needsQuery) return { url: portrait, resolved: true, needsQuery: false };
    if (!armed) return { url: null, resolved: false, needsQuery: true };
    const data = result && result.data;
    const failed = !!(result && result.error);
    if (!data && !failed) return { url: null, resolved: false, needsQuery: true };
    const scene = data && data.findScenes && (data.findScenes.scenes || [])[0];
    const image = data && data.findImages && (data.findImages.images || [])[0];
    const shot = scene && scene.paths ? scene.paths.screenshot : null;
    const thumb = image && image.paths ? image.paths.thumbnail : null;
    if (pref === "scene" && shot) return { url: shot, resolved: true, needsQuery: true };
    if (pref === "photo" && thumb) return { url: thumb, resolved: true, needsQuery: true };
    return { url: portrait, resolved: true, needsQuery: true };
  }
  const loaded = {};
  function preloadPhoto(url) {
    if (!url) return Promise.resolve();
    if (loaded[url]) return Promise.resolve();
    return new Promise((done) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        loaded[url] = true;
        done();
      };
      try {
        const probe = new Image();
        probe.onload = finish;
        probe.onerror = finish;
        window.setTimeout(finish, 5e3);
        probe.src = url;
      } catch {
        finish();
      }
    });
  }
  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      return false;
    }
  }
  function useMounted() {
    const [ref] = useState(() => ({ current: true }));
    useEffect(() => {
      ref.current = true;
      return () => {
        ref.current = false;
      };
    }, [ref]);
    return ref;
  }
  function ageFrom(birthdate, deathDate) {
    if (!birthdate) return null;
    const b = String(birthdate).split("-");
    if (b.length < 3) return null;
    const end = deathDate ? new Date(deathDate) : /* @__PURE__ */ new Date();
    if (isNaN(end.getTime())) return null;
    let age = end.getFullYear() - parseInt(b[0], 10);
    const m = end.getMonth() + 1 - parseInt(b[1], 10);
    if (m < 0 || m === 0 && end.getDate() < parseInt(b[2], 10)) age -= 1;
    return age > 0 && age < 130 ? age : null;
  }
  function weightImperial(kg) {
    if (!kg) return null;
    const lbs = Math.round(kg * 2.20462262185);
    return lbs > 0 ? lbs + " lb" : null;
  }
  let regionNames;
  function countryName(code) {
    if (!code) return null;
    if (regionNames === void 0) {
      try {
        const DN = Intl.DisplayNames;
        regionNames = DN ? new DN(["en"], { type: "region" }) : null;
      } catch {
        regionNames = null;
      }
    }
    if (!regionNames) return code;
    try {
      return regionNames.of(code.toUpperCase()) || code;
    } catch {
      return code;
    }
  }
  function careerRange(start, end) {
    if (!start && !end) return null;
    if (start && end) return start === end ? String(start) : start + " to " + end;
    if (start) return start + " to now";
    return "until " + end;
  }
  function plain(v) {
    const s = (v || "").trim();
    return s ? s : null;
  }
  function portraitPath(imagePath) {
    const p = (imagePath || "").trim();
    if (!p) return null;
    if (/[?&]default=true(&|$)/i.test(p)) return null;
    return p;
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
  const PHASE_OUT_MS = 235;
  const PHASE_IN_MS = 250;
  const CARD_MOBILE_QUERY = "only screen and (max-width: 576px)";
  function useStashCardMobile() {
    const read = () => typeof window.matchMedia === "function" ? window.matchMedia(CARD_MOBILE_QUERY).matches : false;
    const [isMobile, setIsMobile] = useState(read);
    useEffect(() => {
      if (typeof window.matchMedia !== "function") return void 0;
      const mql = window.matchMedia(CARD_MOBILE_QUERY);
      const onChange = () => setIsMobile(mql.matches);
      onChange();
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      }
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }, []);
    return isMobile;
  }
  const PageCard = ({ performer }) => {
    const slotRef = useRef(null);
    const [width, setWidth] = useState(void 0);
    const cardMobile = useStashCardMobile();
    useEffect(() => {
      const el = slotRef.current;
      if (!el) return void 0;
      const measure = () => {
        const w = Math.round(el.getBoundingClientRect().width);
        if (w > 0) setWidth((prev) => prev === w ? prev : w);
      };
      measure();
      return observeDeferred(el, measure);
    }, []);
    const Card = stashComponent(
      "PerformerCard"
    );
    const LightboxLink = stashComponent("LightboxLink");
    const portrait = portraitPath(performer.image_path);
    const [face, setFace] = useState("front");
    const [phase, setPhase] = useState("");
    const [armed, setArmed] = useState(false);
    const [queued, setQueued] = useState(false);
    const mounted = useMounted();
    const back = useBackPhoto(performer, armed);
    const shown = useMemo(
      () => face === "back" && back.url && back.url !== performer.image_path ? { ...performer, image_path: back.url } : performer,
      [performer, face, back.url]
    );
    const [cardEl, setCardEl] = useState(null);
    useLayoutEffect(() => {
      const slot = slotRef.current;
      const el = slot ? slot.querySelector(".performer-card") : null;
      setCardEl((prev) => prev === el ? prev : el);
    });
    const start = useCallback(
      (toBack) => {
        if (prefersReducedMotion()) {
          setFace(toBack ? "back" : "front");
          return;
        }
        setPhase("out");
      },
      []
    );
    const turn = useCallback(() => {
      if (phase) return;
      const toBack = face === "front";
      if (!toBack) {
        start(false);
        return;
      }
      if (!back.resolved) {
        setArmed(true);
        setQueued(true);
        return;
      }
      preloadPhoto(back.url).then(() => {
        if (mounted.current) start(true);
      });
    }, [phase, face, back.resolved, back.url, start, mounted]);
    useEffect(() => {
      if (!queued || !back.resolved) return void 0;
      let live = true;
      preloadPhoto(back.url).then(() => {
        if (!live || !mounted.current) return;
        setQueued(false);
        start(true);
      });
      return () => {
        live = false;
      };
    }, [queued, back.resolved, back.url, start, mounted]);
    useEffect(() => {
      if (phase === "out") {
        const t = window.setTimeout(() => {
          setFace((f) => f === "front" ? "back" : "front");
          setPhase("mid");
        }, PHASE_OUT_MS);
        return () => window.clearTimeout(t);
      }
      if (phase === "in") {
        const t = window.setTimeout(() => setPhase(""), PHASE_IN_MS);
        return () => window.clearTimeout(t);
      }
      return void 0;
    }, [phase]);
    useLayoutEffect(() => {
      if (phase !== "mid") return;
      const slot = slotRef.current;
      const picture = slot ? slot.querySelector(".thumbnail-section") : null;
      if (picture) void picture.offsetWidth;
      setPhase("in");
    }, [phase]);
    const lightboxImages = useMemo(
      () => portrait ? [{ paths: { thumbnail: portrait, image: portrait } }] : [],
      [portrait]
    );
    const lightboxRef = useRef(null);
    const openLightbox = useCallback(() => {
      const host2 = lightboxRef.current;
      const btn = host2 ? host2.querySelector("button") : null;
      if (btn) btn.click();
    }, []);
    const onCardClickCapture = useCallback(
      (e) => {
        if (!portrait || face !== "front" || phase) return;
        const t = e.target;
        if (!t || typeof t.closest !== "function") return;
        if (t.closest("button, .card-section, .card-popovers, .refract-card-back")) return;
        const card = t.closest(".performer-card");
        if (card && card.classList.contains("refract-show-back")) return;
        const picture = t.closest(".thumbnail-section");
        if (!picture) return;
        if (t !== picture && t.tagName !== "IMG") return;
        e.preventDefault();
        e.stopPropagation();
        openLightbox();
      },
      [portrait, face, phase, openLightbox]
    );
    const label = face === "back" ? "Show front photo" : "Show back photo";
    const extras = cardEl && portrait ? createPortal(
      /* @__PURE__ */ R.createElement(R.Fragment, null, LightboxLink && lightboxImages.length ? /* @__PURE__ */ R.createElement("div", { className: "refract-pr-lightbox", ref: lightboxRef }, /* @__PURE__ */ R.createElement(LightboxLink, { images: lightboxImages }, /* @__PURE__ */ R.createElement("span", { className: "refract-pr-lightbox-label" }, "View the photo at full size"))) : null, /* @__PURE__ */ R.createElement(
        "button",
        {
          type: "button",
          className: "refract-pr-pp-flip",
          title: label,
          "aria-label": label,
          onPointerEnter: () => setArmed(true),
          onFocus: () => setArmed(true),
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            turn();
          }
        },
        /* @__PURE__ */ R.createElement(PhotoFlipIcon, null)
      )),
      cardEl
    ) : null;
    const phaseClass = phase ? " is-turn-" + phase : "";
    return /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-pr-card" + phaseClass + (face === "back" ? " is-back" : "") + /* The rail only has two tabs when there is a picture to
        turn. On a performer with none (775 here) the photo tab
        is not drawn, and without this the card's own dossier
        tab would still be standing 44px down the edge making
        room for a control that is not there. */
        (portrait ? " has-photo-flip" : ""),
        ref: slotRef,
        onClickCapture: onCardClickCapture
      },
      Card ? /* @__PURE__ */ R.createElement(Card, { performer: shown, cardWidth: cardMobile ? void 0 : width }) : null,
      extras
    );
  };
  function useTruncationTitle(ref, name, owned) {
    useEffect(() => {
      const el = ref.current;
      if (!el || !owned) return void 0;
      const sync = () => {
        if (el.scrollWidth > el.clientWidth + 1) {
          el.setAttribute("title", name);
        } else {
          el.removeAttribute("title");
        }
      };
      sync();
      window.addEventListener("resize", sync);
      return () => window.removeEventListener("resize", sync);
    }, [ref, name, owned]);
  }
  const Band = ({ performer, actions, standing, quality, owned = true, sparse, children }) => {
    const ExternalLinkButtons = stashComponent("ExternalLinkButtons");
    const shot = portraitPath(performer.image_path);
    const aliases = (performer.alias_list || []).filter(Boolean);
    const nameRef = useRef(null);
    useTruncationTitle(nameRef, performer.name, owned);
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-band" + (sparse ? " is-sparse" : "") }, /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-pr-fill",
        "data-shot": shot ? "1" : void 0,
        style: shot ? {
          "--refract-pr-shot": 'url("' + shot + '")'
        } : void 0,
        "aria-hidden": "true"
      },
      /* @__PURE__ */ R.createElement("div", { className: "refract-pr-blur" }),
      /* @__PURE__ */ R.createElement("div", { className: "refract-pr-veil" })
    ), /* @__PURE__ */ R.createElement(PageCard, { performer }), /* @__PURE__ */ R.createElement("div", { className: "refract-pr-head" }, /* @__PURE__ */ R.createElement("h2", { className: "refract-pr-title" }, /* @__PURE__ */ R.createElement("span", { className: "refract-pr-name", ref: nameRef }, performer.name), performer.disambiguation ? /* @__PURE__ */ R.createElement("span", { className: "refract-pr-disambiguation" }, performer.disambiguation) : null, /* @__PURE__ */ R.createElement("span", { className: "refract-pr-name-icons" }, /* @__PURE__ */ R.createElement(
      FavouriteButton,
      {
        id: performer.id,
        favourite: !!performer.favorite
      }
    ), ExternalLinkButtons ? /* @__PURE__ */ R.createElement(ExternalLinkButtons, { urls: performer.urls || void 0 }) : null)), actions ? /* @__PURE__ */ R.createElement("div", { className: "refract-pr-actions" }, actions) : null, /* @__PURE__ */ R.createElement(AliasChips, { aliases }), standing, quality, children));
  };
  function hasCustomFields(values) {
    try {
      return !!values && Object.keys(values).length > 0;
    } catch {
      return false;
    }
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
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-extension" }, island);
  };
  function stashIdTiles(ids) {
    return /* @__PURE__ */ R.createElement("ul", { className: "refract-pr-sid-list" }, ids.map((s) => {
      let host2 = s.endpoint;
      try {
        host2 = new URL(s.endpoint).hostname.replace(/^www\./, "");
      } catch {
      }
      const base = s.endpoint.replace(/\/graphql\/?$/, "");
      return /* @__PURE__ */ R.createElement("li", { key: s.endpoint + s.stash_id }, /* @__PURE__ */ R.createElement(
        "a",
        {
          className: "refract-pr-sid-pill",
          href: base + "/performers/" + s.stash_id,
          target: "_blank",
          rel: "noopener noreferrer"
        },
        host2
      ), /* @__PURE__ */ R.createElement("span", { className: "refract-pr-sid-value" }, s.stash_id));
    }));
  }
  function buildTiles(performer) {
    const t = [];
    const push = (key, label, value, wide) => {
      if (value === null || value === void 0 || value === "") return;
      t.push({ key, label, value, wide });
    };
    push("gender", "Gender", plain(performer.gender ? titleCase(performer.gender) : null));
    const age = ageFrom(performer.birthdate, performer.death_date);
    if (age != null || performer.birthdate) {
      push(
        "age",
        performer.death_date ? "Age at death" : "Age",
        /* @__PURE__ */ R.createElement(R.Fragment, null, age != null ? age : null, performer.birthdate ? /* @__PURE__ */ R.createElement("span", { className: "refract-pr-tile-tail" }, age != null ? " " : "", "(" + performer.birthdate + ")") : null)
      );
    }
    if (performer.country) {
      push(
        "country",
        "Country",
        /* @__PURE__ */ R.createElement(R.Fragment, null, /* @__PURE__ */ R.createElement(
          "span",
          {
            className: "refract-pr-flag fi fi-" + performer.country.toLowerCase(),
            "aria-hidden": "true"
          }
        ), countryName(performer.country))
      );
    }
    push("ethnicity", "Ethnicity", plain(performer.ethnicity));
    push("hair", "Hair colour", plain(performer.hair_color));
    push("eyes", "Eye colour", plain(performer.eye_color));
    if (performer.height_cm) push("height", "Height", performer.height_cm + " cm");
    if (performer.weight) {
      const lbs = weightImperial(performer.weight);
      push(
        "weight",
        "Weight",
        /* @__PURE__ */ R.createElement(R.Fragment, null, performer.weight + " kg", lbs ? /* @__PURE__ */ R.createElement("span", { className: "refract-pr-tile-tail" }, " (" + lbs + ")") : null)
      );
    }
    push("measurements", "Measurements", plain(performer.measurements));
    push("fake_tits", "Breast type", plain(performer.fake_tits));
    if ((performer.gender || "").toUpperCase() === "MALE") {
      if (performer.penis_length) {
        push("penis_length", "Penis length", performer.penis_length + " cm");
      }
      push("circumcised", "Circumcised", plain(performer.circumcised ? titleCase(performer.circumcised) : null));
    }
    push("tattoos", "Tattoos", plain(performer.tattoos), true);
    push("piercings", "Piercings", plain(performer.piercings), true);
    push("death_date", "Died", plain(performer.death_date));
    const ids = (performer.stash_ids || []).filter((s) => s && s.stash_id);
    if (ids.length) push("stash_ids", "Stash IDs", stashIdTiles(ids));
    return t;
  }
  function titleCase(v) {
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/_/g, " ");
  }
  function columnCount(tiles) {
    let longest = 0;
    let run = 0;
    for (const t of tiles) {
      if (t.wide) {
        run = 0;
        continue;
      }
      run += 1;
      if (run > longest) longest = run;
    }
    if (longest <= 1) return 1;
    if (longest <= 6) return longest;
    return Math.min(6, Math.ceil(longest / 2));
  }
  const ReadoutGrid = ({ performer, extension }) => {
    const tiles = buildTiles(performer);
    if (!tiles.length && !extension) return null;
    const cols = columnCount(tiles);
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-grid", "data-refract-cols": cols }, tiles.map((tile) => /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-pr-tile refract-pr-tile-" + tile.key + (tile.wide ? " is-wide" : ""),
        key: tile.key
      },
      /* @__PURE__ */ R.createElement("span", { className: "refract-pr-tile-label" }, tile.label),
      /* @__PURE__ */ R.createElement("span", { className: "refract-pr-tile-value" }, tile.value)
    )), extension);
  };
  const DetailsRow = ({ details }) => {
    const text = (details || "").trim();
    const [open, setOpen] = useState(false);
    const [clipped, setClipped] = useState(false);
    const bodyRef = useRef(null);
    useLayoutEffect(() => {
      const el = bodyRef.current;
      if (!el) return void 0;
      const measure = () => {
        if (open) return;
        const next = el.scrollHeight - el.clientHeight > 1;
        setClipped((prev) => prev === next ? prev : next);
      };
      measure();
      return observeDeferred(el, measure);
    }, [text, open]);
    if (!text) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-details" + (open ? " is-open" : "") }, /* @__PURE__ */ R.createElement("span", { className: "refract-pr-tile-label" }, "Details"), /* @__PURE__ */ R.createElement("p", { className: "refract-pr-details-body", ref: bodyRef }, text), clipped || open ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-pr-more",
        onClick: () => setOpen(!open),
        "aria-expanded": open
      },
      open ? "Less" : "More"
    ) : null);
  };
  const CRITERION = /^(.+?)\s*★\s*:\s*(\d+(?:\.\d+)?)\s*$/;
  function splitTags(tags) {
    const scored = [];
    const plain2 = [];
    for (const t of tags) {
      const m = CRITERION.exec((t && t.name || "").trim());
      if (m) scored.push({ label: m[1].trim(), value: parseFloat(m[2]) });
      else if (t) plain2.push(t);
    }
    return { scored, plain: plain2 };
  }
  const CriterionMeters = ({ scores }) => {
    if (!scores.length) return null;
    let top = 5;
    for (const s of scores) if (s.value > top) top = s.value;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-ph-cats refract-pr-cats" }, scores.map((s) => /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-ph-cats__cell" + (s.value >= top ? " is-full" : ""),
        key: s.label
      },
      /* @__PURE__ */ R.createElement("div", { className: "refract-ph-cats__head" }, /* @__PURE__ */ R.createElement("span", { className: "refract-ph-cats__label", title: s.label }, s.label), /* @__PURE__ */ R.createElement("span", { className: "refract-ph-cats__value" }, s.value + " of " + top)),
      /* @__PURE__ */ R.createElement("div", { className: "refract-ph-cats__track", "aria-hidden": "true" }, /* @__PURE__ */ R.createElement(
        "div",
        {
          className: "refract-ph-cats__fill",
          style: { width: Math.round(s.value / top * 100) + "%" }
        }
      ))
    )));
  };
  const TagRow = ({ tags }) => {
    const TagLink = stashComponent("TagLink");
    if (!TagLink || !tags.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-tags" }, /* @__PURE__ */ R.createElement("span", { className: "refract-pr-tile-label" }, "Tags"), /* @__PURE__ */ R.createElement("div", { className: "refract-pr-tag-list" }, tags.map((tag) => /* @__PURE__ */ R.createElement(TagLink, { key: tag.id, tag, linkType: "performer" }))));
  };
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
  const VALID_TABS = [
    "default",
    "scenes",
    "galleries",
    "images",
    "groups",
    "appearswith"
  ];
  const bootstrap = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Bootstrap;
  })();
  const configurationHook = stashService().useConfiguration;
  function useAbbreviateCounters() {
    const result = configurationHook ? configurationHook() : void 0;
    const data = result && result.data;
    return !!(data && data.configuration && data.configuration.ui && data.configuration.ui.abbreviateCounters);
  }
  const PerformerTabs = ({ performer, tabKey }) => {
    const history = useHistory();
    const abbreviateCounter = useAbbreviateCounters();
    const TabTitleCounter = stashComponent("TabTitleCounter");
    const defaultTabKey = useMemo(() => {
      if (performer.scene_count) return "scenes";
      if (performer.gallery_count) return "galleries";
      if (performer.image_count) return "images";
      if (performer.group_count) return "groups";
      return "scenes";
    }, [performer]);
    const setTabKey = useCallback(
      (next) => {
        const key = next || defaultTabKey;
        if (key === tabKey) return;
        if (VALID_TABS.indexOf(key) < 0) return;
        history.replace("/performers/" + performer.id + "/" + key);
      },
      [defaultTabKey, tabKey, history, performer.id]
    );
    useEffect(() => {
      if (!tabKey) setTabKey(defaultTabKey);
    }, [setTabKey, defaultTabKey, tabKey]);
    usePageKeybinds({
      c: () => setTabKey("scenes"),
      g: () => setTabKey("galleries"),
      m: () => setTabKey("groups")
    });
    const Tabs = bootstrap && bootstrap.Tabs;
    const Tab = bootstrap && bootstrap.Tab;
    const panels = [
      { key: "scenes", component: "PerformerScenesPanel", messageID: "scenes", count: performer.scene_count || 0 },
      { key: "galleries", component: "PerformerGalleriesPanel", messageID: "galleries", count: performer.gallery_count || 0 },
      { key: "images", component: "PerformerImagesPanel", messageID: "images", count: performer.image_count || 0 },
      { key: "groups", component: "PerformerGroupsPanel", messageID: "groups", count: performer.group_count || 0 },
      { key: "appearswith", component: "PerformerAppearsWithPanel", messageID: "appears_with", count: performer.performer_count || 0 }
    ];
    if (!Tabs || !Tab) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-tabs detail-body" }, /* @__PURE__ */ R.createElement("div", { className: "performer-body" }, /* @__PURE__ */ R.createElement("div", { className: "performer-tabs" }, /* @__PURE__ */ R.createElement(
      Tabs,
      {
        id: "performer-tabs",
        mountOnEnter: true,
        unmountOnExit: true,
        activeKey: tabKey,
        onSelect: setTabKey
      },
      panels.map((p) => {
        const Panel = stashComponent(p.component);
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
          Panel ? /* @__PURE__ */ R.createElement(Panel, { active: tabKey === p.key, performer }) : null
        );
      })
    ))));
  };
  const BADGE_SELECTOR = "#hon-battle-rank-badge, .hon-battle-rank-badge";
  const RANK_TEXT_SELECTOR = ".hon-rank-text";
  const BADGE_TITLE = /battle\s+rank\s+#\s*(\d+)\s*of\s*([\d,]+)/i;
  function wholeNumber(text) {
    const t = text.trim();
    if (!/^\d{1,9}$/.test(t)) return null;
    const n = parseInt(t, 10);
    return n > 0 ? n : null;
  }
  function readBadge() {
    let el = null;
    try {
      el = document.querySelector(BADGE_SELECTOR);
    } catch {
      return null;
    }
    if (!el) return null;
    const rankEl = el.querySelector(RANK_TEXT_SELECTOR);
    const shown = rankEl ? wholeNumber(rankEl.textContent || "") : null;
    if (rankEl && shown === null) return null;
    const m = BADGE_TITLE.exec(el.getAttribute("title") || "");
    if (m) {
      const position = parseInt(m[1], 10);
      const of = parseInt(m[2].replace(/,/g, ""), 10);
      if (position > 0 && (!of || position <= of)) {
        if (shown !== null && shown !== position) return null;
        return { position, of: of || null, source: "ascension" };
      }
      return null;
    }
    if (shown !== null) return { position: shown, of: null, source: "ascension" };
    return null;
  }
  const RANK_QUERY = `
  query RefractPerformerRank($v: Int!) {
    above: findPerformers(
      filter: { per_page: 0 }
      performer_filter: { rating100: { value: $v, modifier: GREATER_THAN } }
    ) { count }
    rated: findPerformers(
      filter: { per_page: 0 }
      performer_filter: { rating100: { value: 0, modifier: GREATER_THAN } }
    ) { count }
  }
`;
  const apollo = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Apollo;
  })();
  const rankDocument = (() => {
    try {
      if (!apollo || !apollo.gql) return null;
      return apollo.gql([RANK_QUERY]);
    } catch {
      return null;
    }
  })();
  const useApolloQuery = apollo && apollo.useQuery;
  function useRank(rating100) {
    const [badge, setBadge] = useState(null);
    useEffect(() => {
      setBadge(readBadge());
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        const present2 = !!document.querySelector(BADGE_SELECTOR);
        if (present2 || tries > 8) {
          window.clearInterval(t);
          if (present2) setBadge(readBadge());
        }
      }, 250);
      return () => window.clearInterval(t);
    }, [rating100]);
    const wantQuery = !badge && !!rating100 && !!rankDocument && !!useApolloQuery;
    const result = useApolloQuery ? useApolloQuery(rankDocument, {
      variables: { v: rating100 || 0 },
      skip: !wantQuery
    }) : void 0;
    if (badge) return badge;
    const above = result && result.data && result.data.above;
    const rated = result && result.data && result.data.rated;
    if (!above || !rated) return null;
    return { position: above.count + 1, of: rated.count, source: "rating" };
  }
  const StandingRow = ({ performer }) => {
    const rank = useRank(performer.rating100);
    const career = careerRange(performer.career_start, performer.career_end);
    const cells = [];
    if (rank) {
      cells.push({
        label: "Ranking",
        value: String(rank.position),
        tail: rank.of ? "of " + rank.of.toLocaleString() : void 0
      });
    }
    if (career) {
      const parts = career.split(" to ");
      cells.push({ label: "Active", value: parts[0], tail: parts[1] ? "to " + parts[1] : void 0 });
    }
    if (!cells.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-standing" }, cells.map((c) => /* @__PURE__ */ R.createElement("div", { className: "refract-pr-standing-cell", key: c.label }, /* @__PURE__ */ R.createElement("span", { className: "refract-pr-standing-label" }, c.label), /* @__PURE__ */ R.createElement("span", { className: "refract-pr-standing-value" }, c.value, c.tail ? /* @__PURE__ */ R.createElement("span", { className: "refract-pr-standing-tail" }, " ", c.tail) : null))));
  };
  const QualityGroup = ({
    performer,
    active = true
  }) => {
    const RatingSystem = stashComponent("RatingSystem");
    const [updatePerformer] = usePerformerUpdate();
    const setRating = useCallback(
      (value) => {
        if (!canUpdatePerformer) return;
        updatePerformer({
          variables: { input: { id: performer.id, rating100: value } }
        }).catch((e) => warnOnce("could not set rating", e));
      },
      [performer.id, updatePerformer]
    );
    useRatingKeybinds(setRating, active);
    if (!RatingSystem) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "quality-group" }, /* @__PURE__ */ R.createElement(
      RatingSystem,
      {
        value: performer.rating100,
        onSetRating: setRating,
        clickToRate: true,
        withoutContext: true,
        disabled: !canUpdatePerformer
      }
    ));
  };
  const RatingControl = ({
    performer,
    active = true
  }) => {
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
    useEffect(() => {
      if (!active) setOpen(false);
    }, [active]);
    const r = performer.rating100;
    const rated = typeof r === "number" && r > 0;
    const tier = rated ? tierFor(r) : void 0;
    const value = rated ? ratingDisplay(r, starsMode) : "";
    const outOf = starsMode ? " of 5" : " of 10";
    const label = rated ? "Rated " + value + outOf + (tier ? ", " + tier : "") + ". Change rating" : "Not rated. Rate this performer";
    return /* @__PURE__ */ R.createElement("div", { className: "refract-pr-rating" + (open ? " is-open" : ""), ref: box }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        ref: chip,
        className: "st-tier-chip refract-pr-tier-chip",
        "aria-expanded": open,
        "aria-label": label,
        title: label,
        "data-tier": tier || "",
        "data-rated": rated ? "1" : "0",
        onClick: () => setOpen((o) => !o)
      },
      /* @__PURE__ */ R.createElement("span", { className: "st-tier-name" }, rated ? tier || "Rated" : "Rate"),
      /* @__PURE__ */ R.createElement("span", { className: "st-tier-value", hidden: !value }, value)
    ), /* @__PURE__ */ R.createElement(QualityGroup, { performer, active }));
  };
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
  const EDIT_SELECTOR = ".detail-header.edit";
  const DIALOG_SELECTOR = ".modal.show";
  function present(selector) {
    try {
      return !!document.querySelector(selector);
    } catch {
      return false;
    }
  }
  function useReturnWhenGone(active, selector, done) {
    useEffect(() => {
      if (!active) return void 0;
      if (typeof MutationObserver === "undefined") return void 0;
      let seen = present(selector);
      let finished = false;
      const check = () => {
        if (finished) return;
        if (present(selector)) {
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
    }, [active, selector, done]);
  }
  function useReturnFromEdit(active, done) {
    useReturnWhenGone(active, EDIT_SELECTOR, done);
  }
  function useReturnFromDialog(active, done) {
    useReturnWhenGone(active, DIALOG_SELECTOR, done);
  }
  function useEscapeToReturn(active, done) {
    useEffect(() => {
      if (!active) return void 0;
      const onKey = (e) => {
        if (e.key !== "Escape" || e.defaultPrevented) return;
        try {
          if (present(EDIT_SELECTOR)) return;
          if (document.querySelector(".modal.show, .dropdown-menu.show")) return;
          const t = e.target;
          const tag = t && t.tagName ? t.tagName.toLowerCase() : "";
          if (tag === "input" || tag === "textarea" || tag === "select") return;
          if (t && t.isContentEditable) return;
        } catch {
        }
        done();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [active, done]);
  }
  const REQUIRED_COMPONENTS = [
    "PerformerCard",
    "RatingSystem",
    "CustomFields",
    "TagLink",
    "TabTitleCounter",
    "ExternalLinkButtons",
    "PerformerScenesPanel",
    "PerformerGalleriesPanel",
    "PerformerImagesPanel",
    "PerformerGroupsPanel",
    "PerformerAppearsWithPanel"
  ];
  const OWNED_BODY_CLASS = "refract-owned-performer";
  function setBodyClass(on) {
    try {
      if (!document.body) return;
      document.body.classList.toggle(OWNED_BODY_CLASS, on);
    } catch {
    }
  }
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
  function useStandbyStage(attached, mounted) {
    const host2 = useRef(null);
    const stage = useRef(null);
    if (!stage.current && typeof document !== "undefined") {
      stage.current = document.createElement("div");
      stage.current.className = "refract-pr-stage";
      stage.current.style.display = "contents";
    }
    useLayoutEffect(() => {
      const el = stage.current;
      if (!el) return void 0;
      if (attached && mounted) {
        const parent = host2.current;
        if (parent && el.parentNode !== parent) parent.appendChild(el);
      } else if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
      return () => {
        if (el.parentNode) el.parentNode.removeChild(el);
      };
    }, [attached, mounted]);
    return [stage.current, host2];
  }
  const PerformerRoute = (props) => {
    const { performer, tabKey, next: Next } = props;
    const [mode, setMode] = useState("view");
    const [intent, setIntent] = useState(void 0);
    const [handedBack, setHandedBack] = useState(false);
    const enabled = ownPerformerPageEnabled();
    const capable = useCapability();
    const mounted = enabled && capable && !handedBack;
    const owning = mounted && mode === "view";
    const [stage, host2] = useStandbyStage(owning, mounted);
    useEffect(() => {
      if (!owning) return void 0;
      announceOnce("owns /performers/" + performer.id);
      setBodyClass(true);
      return () => setBodyClass(false);
    }, [owning, performer.id]);
    useEffect(() => {
      if (mode !== "edit") return;
      const mt = mousetrap();
      if (!mt) return;
      try {
        mt.trigger("e");
      } catch {
      }
    }, [mode]);
    const startEdit = useCallback(() => setMode("edit"), []);
    const handOver = useCallback((why) => {
      setIntent(why);
      setMode("stash");
    }, []);
    const takeBack = useCallback(() => {
      setIntent(void 0);
      setMode("view");
    }, []);
    useEffect(() => {
      if (mode !== "stash" || intent !== "merge") return void 0;
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        if (tries > 60) {
          window.clearInterval(t);
          warnOnce("handed the page over for Merge but never found Stash's row");
          setIntent(void 0);
          return;
        }
        const row = document.querySelector(
          "#performer-page .detail-header .details-edit"
        );
        if (!row) return;
        const buttons = Array.prototype.slice.call(
          row.querySelectorAll("button, .btn")
        );
        const item = buttons.filter(
          (b) => /^merge/i.test((b.textContent || "").trim())
        )[0];
        if (!item) {
          return;
        }
        window.clearInterval(t);
        setIntent(void 0);
        item.click();
      }, 50);
      return () => window.clearInterval(t);
    }, [mode, intent]);
    useEffect(() => setMode("view"), [performer.id]);
    useEffect(() => setMode((m) => m === "stash" ? "view" : m), [tabKey]);
    useReturnFromEdit(mode === "edit", takeBack);
    useReturnFromDialog(mode === "stash" && intent === void 0, takeBack);
    useEscapeToReturn(mode === "stash", takeBack);
    const [updatePerformer] = usePerformerUpdate();
    const toggleFavourite = useCallback(() => {
      if (!canUpdatePerformer) return;
      updatePerformer({
        variables: { input: { id: performer.id, favorite: !performer.favorite } }
      }).catch((e) => warnOnce("could not set favourite", e));
    }, [updatePerformer, performer.id, performer.favorite]);
    usePageKeybinds({ e: startEdit, f: toggleFavourite }, owning);
    const fallback = /* @__PURE__ */ R.createElement(Next, { performer, tabKey });
    return /* @__PURE__ */ R.createElement(R.Fragment, null, mounted && mode === "stash" ? /* @__PURE__ */ R.createElement("div", { className: "refract-pr-return" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "refract-pr-more", onClick: takeBack }, "Back to Refract’s page")) : null, owning ? null : fallback, mounted ? /* @__PURE__ */ R.createElement("div", { className: "refract-pr-host", style: HOST_STYLE, ref: host2 }, stage ? createPortal(
      /* @__PURE__ */ R.createElement(
        RefractErrorBoundary,
        {
          fallback: owning ? fallback : null,
          onTrip: () => setHandedBack(true)
        },
        /* @__PURE__ */ R.createElement(
          PerformerView,
          {
            performer,
            tabKey,
            owned: owning,
            onEdit: startEdit,
            onHandOver: handOver
          }
        )
      ),
      stage
    ) : null) : null);
  };
  const HOST_STYLE = { display: "contents" };
  const STANDBY_STYLE = { display: "none" };
  const PerformerView = ({ performer, tabKey, owned, onEdit, onHandOver }) => {
    useEffect(() => {
      if (!owned) return void 0;
      const was = document.title;
      document.title = performer.name;
      return () => {
        document.title = was;
      };
    }, [performer.name, owned]);
    const tags = performer.tags || [];
    const { scored, plain: plain2 } = splitTags(tags);
    const extension = hasCustomFields(performer.custom_fields) ? /* @__PURE__ */ R.createElement(ExtensionSlot, { customFields: performer.custom_fields }) : null;
    const sparse = !portraitPath(performer.image_path) && !buildTiles(performer).length && !extension && !tags.length && !(performer.details || "").trim() && !(performer.alias_list || []).filter(Boolean).length;
    return /* @__PURE__ */ R.createElement(
      "div",
      {
        id: owned ? "performer-page" : void 0,
        className: "refract-pr",
        style: owned ? void 0 : STANDBY_STYLE
      },
      /* @__PURE__ */ R.createElement(
        Band,
        {
          performer,
          owned,
          sparse,
          standing: /* @__PURE__ */ R.createElement(StandingRow, { performer }),
          quality: /* @__PURE__ */ R.createElement(RatingControl, { performer, active: owned }),
          actions: /* @__PURE__ */ R.createElement(
            ActionBar,
            {
              performer,
              onEdit,
              onHandOver
            }
          )
        },
        /* @__PURE__ */ R.createElement(ReadoutGrid, { performer, extension }),
        /* @__PURE__ */ R.createElement(CriterionMeters, { scores: scored }),
        /* @__PURE__ */ R.createElement(DetailsRow, { details: performer.details }),
        /* @__PURE__ */ R.createElement(TagRow, { tags: plain2 }),
        sparse ? /* @__PURE__ */ R.createElement("p", { className: "refract-pr-blank" }, "No details recorded yet. Edit adds them, and Auto tag looks for scenes that match this name.") : null
      ),
      owned ? /* @__PURE__ */ R.createElement(PerformerTabs, { performer, tabKey }) : null
    );
  };
  function register() {
    const api = pluginApi();
    if (!api || !api.patch || typeof api.patch.instead !== "function" || !api.React) {
      window.setTimeout(register, 100);
      return;
    }
    try {
      api.patch.instead("PerformerPage", function(...args) {
        const next = args.pop();
        const props = args[0];
        if (!props || !props.performer) {
          return R.createElement(next, props);
        }
        return R.createElement(PerformerRoute, {
          performer: props.performer,
          tabKey: props.tabKey,
          next
        });
      });
    } catch (e) {
      warnOnce("could not patch PerformerPage", e);
    }
  }
  register();
})();
