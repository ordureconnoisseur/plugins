(function() {
  "use strict";
  const host = window;
  const React = host.PluginApi && host.PluginApi.React;
  if (!React) {
    throw new Error("refract-tag: PluginApi.React is not available");
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
      console.info("[refract-tag] " + what);
    } catch {
    }
  }
  function warnOnce(what, err) {
    if (announced["warn:" + what]) return;
    announced["warn:" + what] = true;
    try {
      if (err === void 0) {
        console.warn("[refract-tag] " + what);
      } else {
        console.warn("[refract-tag] " + what, err);
      }
    } catch {
    }
  }
  function stashService() {
    const api = pluginApi();
    return api && api.utils && api.utils.StashService || {};
  }
  const tagUpdateHook = stashService().useTagUpdate;
  const tagDestroyHook = stashService().useTagDestroy;
  const noopTuple = [
    () => Promise.reject(new Error("refract-tag: mutation unavailable")),
    void 0
  ];
  const canUpdateTag = !!tagUpdateHook;
  const canDestroyTag = !!tagDestroyHook;
  function useTagUpdate() {
    if (!tagUpdateHook) return noopTuple;
    return tagUpdateHook();
  }
  function useTagDestroy(id) {
    if (!tagDestroyHook) return noopTuple;
    return tagDestroyHook({ id });
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
  function useLocationPathname() {
    if (useRouterLocation) return useRouterLocation().pathname;
    return window.location.pathname;
  }
  const configurationHook = stashService().useConfiguration;
  function useUiConfig() {
    const result = configurationHook ? configurationHook() : void 0;
    const data = result && result.data;
    return data && data.configuration && data.configuration.ui || {};
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
  const ActionBar = ({ tag, onEdit, onHandOver, confirming, setConfirming }) => {
    const [busy, setBusy] = useState(false);
    const [confirmingAutoTag, setConfirmingAutoTag] = useState(false);
    const [merging, setMerging] = useState(false);
    useCancelFocus(confirming || confirmingAutoTag);
    const svc = stashService();
    const history = useHistory();
    const AlertModal = stashComponent("AlertModal");
    const TagMergeModal = stashComponent("TagMergeModal");
    const autoTag = useCallback(() => {
      setConfirmingAutoTag(false);
      const fn = svc.mutateMetadataAutoTag;
      if (!fn) return;
      setBusy(true);
      fn({ tags: [tag.id] }).catch((e) => warnOnce("could not start auto tagging", e)).then(() => setBusy(false));
    }, [svc, tag.id]);
    const [destroyTag] = useTagDestroy(tag.id);
    const confirmDelete = useCallback(() => {
      setConfirming(false);
      if (!canDestroyTag) return;
      destroyTag().then(() => history.push("/tags")).catch((e) => warnOnce("could not delete tag", e));
    }, [destroyTag, history, setConfirming]);
    const closeMerge = useCallback(
      (mergedId) => {
        setMerging(false);
        if (mergedId !== void 0 && mergedId !== tag.id) {
          history.replace("/tags/" + mergedId);
        }
      },
      [history, tag.id]
    );
    const autoTagDisabled = busy || !svc.mutateMetadataAutoTag || !!tag.ignore_auto_tag;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-tr-action-row" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "btn btn-primary refract-tr-edit", onClick: onEdit }, "Edit"), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-secondary",
        onClick: () => setConfirmingAutoTag(true),
        disabled: autoTagDisabled || !AlertModal,
        title: tag.ignore_auto_tag ? "Auto tagging is switched off for this tag" : void 0
      },
      "Auto tag…"
    ), TagMergeModal ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-secondary",
        onClick: () => setMerging(true)
      },
      "Merge…"
    ) : (
      /* No merge dialog in this Stash's registry, so the only
         way to Merge is Stash's own row. The label says what
         the button does rather than promising a menu, and
         Escape hands the page back (useHandBack.ts). */
      /* @__PURE__ */ R.createElement("button", { type: "button", className: "btn btn-secondary", onClick: onHandOver }, "Open Stash’s page")
    ), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn refract-tr-delete",
        onClick: () => setConfirming(true),
        disabled: !canDestroyTag
      },
      "Delete"
    ), AlertModal ? /* @__PURE__ */ R.createElement(
      AlertModal,
      {
        show: confirming,
        text: "Delete " + tag.name + "?",
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
    ) : null, TagMergeModal ? /* @__PURE__ */ R.createElement(TagMergeModal, { show: merging, onClose: closeMerge, tags: [tag] }) : null);
  };
  const HeartIcon = () => /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 512 512", fill: "currentColor", "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ R.createElement("path", { d: "M225.8 468.2l-2.5-2.3L48.1 303.2C17.4 274.7 0 234.7 0 192.8l0-3.3c0-70.4 50-130.8 119.2-144 39.1-7.4 79.4 .9 109.4 22.8c12.2 8.9 19.4 18.2 27.4 28.5 8-10.3 15.3-19.6 27.4-28.5 30-21.9 70.3-30.2 109.4-22.8C462 53.5 512 113.9 512 184.3l0 3.5c0 41.9-17.4 81.9-48.1 110.4L289.6 466c-.8 .8-1.7 1.5-2.5 2.3-9.5 8.8-22 13.7-35 13.7s-25.5-4.9-35-13.7z" }));
  const LineageStep = () => /* @__PURE__ */ R.createElement(
    "svg",
    {
      className: "refract-tr-lineage-step",
      viewBox: "0 0 12 12",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1",
      strokeLinecap: "square",
      "aria-hidden": "true",
      focusable: "false"
    },
    /* @__PURE__ */ R.createElement("path", { d: "M9.5 1.5 V 8.5 H 2.5" })
  );
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
  const FavouriteButton = ({ id, favourite }) => {
    const [updateTag] = useTagUpdate();
    const toggle = useCallback(() => {
      if (!canUpdateTag) return;
      updateTag({ variables: { input: { id, favorite: !favourite } } }).catch(
        (e) => warnOnce("could not set favourite", e)
      );
    }, [id, favourite, updateTag]);
    usePageKeybinds({ f: toggle });
    return /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-tr-icon-btn refract-tr-favourite" + (favourite ? " is-on" : ""),
        onClick: toggle,
        disabled: !canUpdateTag,
        "aria-pressed": favourite,
        title: favourite ? "Remove from favourites" : "Add to favourites"
      },
      /* @__PURE__ */ R.createElement(HeartIcon, null)
    );
  };
  const Lineage = ({ parents }) => {
    const TagLink = stashComponent("TagLink");
    if (!TagLink || !parents.length) return null;
    return /* @__PURE__ */ R.createElement("nav", { className: "refract-tr-lineage", "aria-label": "Parent tags" }, parents.map((p, i) => /* @__PURE__ */ R.createElement(R.Fragment, { key: p.id }, i > 0 ? /* @__PURE__ */ R.createElement("span", { className: "refract-tr-lineage-sep", "aria-hidden": "true" }) : null, /* @__PURE__ */ R.createElement(
      TagLink,
      {
        tag: p,
        linkType: "details",
        hoverPlacement: "bottom",
        showHierarchyIcon: p.parent_count !== 0,
        hierarchyTooltipID: "tag_parent_tooltip"
      }
    ))), /* @__PURE__ */ R.createElement(LineageStep, null));
  };
  const ChipRun = ({ label, className, budget, count, moreLabel, children }) => {
    const [open, setOpen] = useState(false);
    const [clipped, setClipped] = useState(false);
    const listRef = useRef(null);
    useLayoutEffect(() => {
      const el = listRef.current;
      if (!el) return void 0;
      const measure = () => {
        setClipped(el.scrollHeight - el.clientHeight > 12);
      };
      measure();
      if (typeof ResizeObserver === "undefined") return void 0;
      let pending = 0;
      const later = () => {
        if (pending) return;
        pending = window.requestAnimationFrame(() => {
          pending = 0;
          measure();
        });
      };
      const ro = new ResizeObserver(later);
      ro.observe(el);
      return () => {
        ro.disconnect();
        if (pending) window.cancelAnimationFrame(pending);
      };
    }, [count, open]);
    const onListFocus = (e) => {
      const el = listRef.current;
      if (!el || open || !el.contains(e.target)) return;
      if (el.scrollTop > 0) {
        setOpen(true);
        el.scrollTop = 0;
      }
    };
    if (!count) return null;
    return /* @__PURE__ */ R.createElement("div", { className: className + " refract-tr-run" + (open ? " is-open" : "") }, label ? /* @__PURE__ */ R.createElement("span", { className: "refract-tr-label" }, label) : null, /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-tr-run-list",
        "data-budget": budget,
        ref: listRef,
        onFocus: onListFocus
      },
      children
    ), clipped || open ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-tr-reveal",
        onClick: () => setOpen(!open),
        "aria-expanded": open ? "true" : "false"
      },
      open ? "Show fewer" : moreLabel(count)
    ) : null);
  };
  function num(n) {
    try {
      return Number(n).toLocaleString();
    } catch {
      return String(n);
    }
  }
  const Description = ({ text }) => {
    const body = (text || "").trim();
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
      let pending = 0;
      const later = () => {
        if (pending) return;
        pending = window.requestAnimationFrame(() => {
          pending = 0;
          measure();
        });
      };
      const ro = new ResizeObserver(later);
      ro.observe(el);
      return () => {
        ro.disconnect();
        if (pending) window.cancelAnimationFrame(pending);
      };
    }, [body, open]);
    if (!body) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-tr-description" + (open ? " is-open" : "") }, /* @__PURE__ */ R.createElement("span", { className: "refract-tr-label" }, "Description"), /* @__PURE__ */ R.createElement("p", { className: "refract-tr-description-body", ref: bodyRef }, body), clipped || open ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-tr-reveal",
        onClick: () => setOpen(!open),
        "aria-expanded": open
      },
      open ? "Less" : "More"
    ) : null);
  };
  const SubTags = ({ tags }) => {
    const TagLink = stashComponent("TagLink");
    if (!TagLink || !tags.length) return null;
    return /* @__PURE__ */ R.createElement(
      ChipRun,
      {
        label: "Sub-tags",
        className: "refract-tr-subtags",
        budget: "rows",
        count: tags.length,
        moreLabel: (n) => n === 1 ? "Show the sub-tag" : "Show all " + num(n) + " sub-tags"
      },
      tags.map((c) => /* @__PURE__ */ R.createElement(
        TagLink,
        {
          key: c.id,
          tag: c,
          linkType: "details",
          hoverPlacement: "bottom",
          showHierarchyIcon: c.child_count !== 0,
          hierarchyTooltipID: "tag_sub_tag_tooltip"
        }
      ))
    );
  };
  const AliasChips = ({ aliases }) => {
    if (!aliases.length) return null;
    return /* @__PURE__ */ R.createElement(
      ChipRun,
      {
        className: "refract-tr-aliases",
        budget: "row",
        count: aliases.length,
        moreLabel: (n) => n === 1 ? "Show the alias" : "Show all " + num(n) + " aliases"
      },
      aliases.map((a) => /* @__PURE__ */ R.createElement("span", { className: "refract-chip", key: a }, a))
    );
  };
  const StashIds = ({ ids }) => {
    const live = ids.filter((s) => s && s.stash_id);
    if (!live.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-tr-sids" }, /* @__PURE__ */ R.createElement("span", { className: "refract-tr-label" }, "Stash IDs"), /* @__PURE__ */ R.createElement("ul", { className: "refract-tr-sid-list" }, live.map((s) => {
      let host2 = s.endpoint;
      try {
        host2 = new URL(s.endpoint).hostname.replace(/^www\./, "");
      } catch {
      }
      const base = s.endpoint.replace(/\/graphql\/?$/, "");
      return /* @__PURE__ */ R.createElement("li", { key: s.endpoint + s.stash_id }, /* @__PURE__ */ R.createElement(
        "a",
        {
          className: "refract-tr-sid-pill",
          href: base + "/tags/" + s.stash_id,
          target: "_blank",
          rel: "noopener noreferrer"
        },
        host2
      ), /* @__PURE__ */ R.createElement("span", { className: "refract-tr-sid-value" }, s.stash_id));
    })));
  };
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
    return /* @__PURE__ */ R.createElement("div", { className: "refract-tr-extension" }, island);
  };
  const ScopeControl = ({ childCount, ownCount, allCount, noun, wide, onChange }) => {
    if (!childCount || !allCount) return null;
    const wideLabel = childCount === 1 ? "With its 1 sub-tag" : "With all " + num(childCount) + " sub-tags";
    const root = useRef(null);
    const onKeyDown = useCallback((e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step || !root.current) return;
      const segs = Array.prototype.slice.call(
        root.current.querySelectorAll(".refract-tr-scope-seg")
      );
      const at = segs.indexOf(document.activeElement);
      if (at < 0 || segs.length < 2) return;
      e.preventDefault();
      segs[(at + step + segs.length) % segs.length].focus();
    }, []);
    return /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-tr-scope",
        "data-scope": wide ? "all" : "own",
        role: "group",
        "aria-label": "Which tags to include",
        ref: root,
        onKeyDown
      },
      /* @__PURE__ */ R.createElement(
        "button",
        {
          type: "button",
          className: "refract-tr-scope-seg",
          "data-seg": "own",
          "aria-pressed": !wide,
          onClick: () => onChange(false)
        },
        /* @__PURE__ */ R.createElement("span", { className: "refract-tr-label" }, "This tag"),
        /* @__PURE__ */ R.createElement("span", { className: "refract-tr-scope-value" }, num(ownCount), " ", /* @__PURE__ */ R.createElement("span", { className: "refract-tr-scope-noun" }, noun))
      ),
      /* @__PURE__ */ R.createElement(
        "button",
        {
          type: "button",
          className: "refract-tr-scope-seg",
          "data-seg": "all",
          "aria-pressed": wide,
          onClick: () => onChange(true)
        },
        /* @__PURE__ */ R.createElement("span", { className: "refract-tr-label" }, wideLabel),
        /* @__PURE__ */ R.createElement("span", { className: "refract-tr-scope-value" }, num(allCount), " ", /* @__PURE__ */ R.createElement("span", { className: "refract-tr-scope-noun" }, noun))
      )
    );
  };
  const Band = ({ tag, actions, scope }) => {
    const shot = tag.image_path || "";
    const realShot = shot && shot.indexOf("default=true") === -1 ? shot : "";
    const aliases = (tag.aliases || []).filter(Boolean);
    const parents = tag.parents || [];
    const children = tag.children || [];
    return /* @__PURE__ */ R.createElement("div", { className: "refract-tr-band", "data-plate": realShot ? "1" : void 0 }, /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-tr-fill",
        "data-shot": realShot ? "1" : void 0,
        style: realShot ? { "--refract-tr-shot": 'url("' + realShot + '")' } : void 0,
        "aria-hidden": "true"
      },
      /* @__PURE__ */ R.createElement("div", { className: "refract-tr-blur" }),
      /* @__PURE__ */ R.createElement("div", { className: "refract-tr-veil" })
    ), realShot ? /* @__PURE__ */ R.createElement("div", { className: "refract-tr-plate" }, /* @__PURE__ */ R.createElement("img", { src: realShot, alt: "" })) : null, /* @__PURE__ */ R.createElement("div", { className: "refract-tr-head" }, /* @__PURE__ */ R.createElement("div", { className: "refract-tr-identity" }, /* @__PURE__ */ R.createElement(Lineage, { parents }), /* @__PURE__ */ R.createElement("h2", { className: "refract-tr-title" }, /* @__PURE__ */ R.createElement("span", { className: "refract-tr-name" }, tag.name), /* @__PURE__ */ R.createElement("span", { className: "refract-tr-name-icons" }, /* @__PURE__ */ R.createElement(FavouriteButton, { id: tag.id, favourite: !!tag.favorite })))), actions ? /* @__PURE__ */ R.createElement("div", { className: "refract-tr-actions" }, actions) : null, /* @__PURE__ */ R.createElement(AliasChips, { aliases }), /* @__PURE__ */ R.createElement(
      ScopeControl,
      {
        childCount: scope.childCount,
        ownCount: scope.ownCount,
        allCount: scope.allCount,
        noun: scope.noun,
        wide: scope.wide,
        onChange: scope.onChange
      }
    ), /* @__PURE__ */ R.createElement(Description, { text: tag.description }), /* @__PURE__ */ R.createElement(SubTags, { tags: children }), /* @__PURE__ */ R.createElement(StashIds, { ids: tag.stash_ids || [] }), /* @__PURE__ */ R.createElement(ExtensionSlot, { customFields: tag.custom_fields })));
  };
  const CHUNKS = [
    "Scenes",
    /* FilteredSceneList */
    "SceneMarkerList",
    /* FilteredSceneMarkerList */
    "Images",
    /* FilteredImageList */
    "Galleries",
    /* FilteredGalleryList */
    "Groups",
    /* FilteredGroupList */
    "Performers",
    /* FilteredPerformerList */
    "Studios"
    /* FilteredStudioList */
  ];
  let asked = false;
  function loadListChunks() {
    if (asked) return;
    asked = true;
    const api = pluginApi();
    const loadable = api && api.loadableComponents;
    const load = api && api.utils && api.utils.loadComponents;
    if (!loadable || typeof load !== "function") return;
    const want = CHUNKS.map((n) => loadable[n]).filter(
      (f) => typeof f === "function"
    );
    if (!want.length) return;
    try {
      const p = load(want);
      if (p && typeof p.catch === "function") {
        p.catch((e) => warnOnce("could not load a list chunk", e));
      }
    } catch (e) {
      warnOnce("could not load the list chunks", e);
    }
  }
  const INCLUDES_ALL = "INCLUDES_ALL";
  const INCLUDES = "INCLUDES";
  function makeTagFilterHook(tag, wide, variant) {
    return (filter) => {
      const tagValue = { id: tag.id, label: tag.name };
      const existing = filter.criteria.find(
        (c) => c && c.criterionOption && c.criterionOption.type === "tags"
      );
      const usable = !!existing && (existing.modifier === INCLUDES_ALL || existing.modifier === INCLUDES);
      if (existing && usable) {
        if (!existing.value.items.find((p) => p.id === tag.id)) {
          existing.value.items.push(tagValue);
        }
        existing.modifier = INCLUDES_ALL;
        return filter;
      }
      if (existing && variant !== "markers") {
        existing.value.items = [tagValue];
        existing.modifier = INCLUDES_ALL;
        return filter;
      }
      if (typeof filter.makeCriterion !== "function") return filter;
      const made = filter.makeCriterion("tags");
      if (!made) return filter;
      made.value = {
        items: [tagValue],
        excluded: [],
        depth: wide ? -1 : 0
      };
      if (variant !== "markers") made.modifier = INCLUDES_ALL;
      filter.criteria.push(made);
      return filter;
    };
  }
  const VALID_TABS = [
    "default",
    "scenes",
    "images",
    "galleries",
    "groups",
    "markers",
    "performers",
    "studios"
  ];
  const bootstrap = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Bootstrap;
  })();
  const TAB_SPECS = [
    { key: "scenes", component: "FilteredSceneList", messageID: "scenes", noun: "scenes", view: "tag_scenes", own: "scene_count", all: "scene_count_all" },
    { key: "images", component: "FilteredImageList", messageID: "images", noun: "images", view: "tag_images", own: "image_count", all: "image_count_all" },
    { key: "galleries", component: "FilteredGalleryList", messageID: "galleries", noun: "galleries", view: "tag_galleries", own: "gallery_count", all: "gallery_count_all" },
    { key: "groups", component: "FilteredGroupList", messageID: "groups", noun: "groups", view: "tag_groups", own: "group_count", all: "group_count_all" },
    { key: "markers", component: "FilteredSceneMarkerList", messageID: "markers", noun: "markers", view: "tag_markers", own: "scene_marker_count", all: "scene_marker_count_all", variant: "markers" },
    { key: "performers", component: "FilteredPerformerList", messageID: "performers", noun: "performers", view: "tag_performers", own: "performer_count", all: "performer_count_all" },
    { key: "studios", component: "FilteredStudioList", messageID: "studios", noun: "studios", own: "studio_count", all: "studio_count_all" }
  ];
  function countFor(tag, spec, wide) {
    const v = tag[wide ? spec.all : spec.own];
    return typeof v === "number" ? v : 0;
  }
  function defaultTabFor(tag, wide) {
    for (const spec of TAB_SPECS) {
      if (countFor(tag, spec, wide)) return spec.key;
    }
    return "scenes";
  }
  const LIST_COMPONENTS = [
    "FilteredSceneList",
    "FilteredImageList",
    "FilteredGalleryList",
    "FilteredGroupList",
    "FilteredSceneMarkerList",
    "FilteredPerformerList",
    "FilteredStudioList"
  ];
  function useListsReady() {
    const [ready, setReady] = useState(() => haveComponents(LIST_COMPONENTS));
    useEffect(() => {
      if (ready) return void 0;
      loadListChunks();
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        if (haveComponents(LIST_COMPONENTS)) {
          window.clearInterval(t);
          setReady(true);
        } else if (tries > 50) {
          window.clearInterval(t);
          warnOnce(
            "these lists never registered, their tabs will be empty: " + LIST_COMPONENTS.filter((n) => !haveComponents([n])).join(", ")
          );
        }
      }, 200);
      return () => window.clearInterval(t);
    }, [ready]);
    return ready;
  }
  const TagTabs = ({ tag, tabKey, wide }) => {
    const history = useHistory();
    useListsReady();
    const ui = useUiConfig();
    const abbreviateCounter = !!ui.abbreviateCounters;
    const TabTitleCounter = stashComponent("TabTitleCounter");
    const defaultTabKey = useMemo(() => defaultTabFor(tag, wide), [tag, wide]);
    const setTabKey = useCallback(
      (next) => {
        const key = next || defaultTabKey;
        if (key === tabKey) return;
        if (VALID_TABS.indexOf(key) < 0) return;
        history.replace("/tags/" + tag.id + "/" + key);
      },
      [defaultTabKey, tabKey, history, tag.id]
    );
    useEffect(() => {
      if (!tabKey) setTabKey(defaultTabKey);
    }, [setTabKey, defaultTabKey, tabKey]);
    const Tabs = bootstrap && bootstrap.Tabs;
    const Tab = bootstrap && bootstrap.Tab;
    if (!Tabs || !Tab) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-tr-tabs detail-body" }, /* @__PURE__ */ R.createElement("div", { className: "tag-body" }, /* @__PURE__ */ R.createElement("div", { className: "tag-tabs" }, /* @__PURE__ */ R.createElement(
      Tabs,
      {
        id: "tag-tabs",
        mountOnEnter: true,
        unmountOnExit: true,
        activeKey: tabKey,
        onSelect: setTabKey
      },
      TAB_SPECS.map((spec) => {
        const count = countFor(tag, spec, wide);
        const otherCount = countFor(tag, spec, !wide);
        const List = stashComponent(spec.component);
        return /* @__PURE__ */ R.createElement(
          Tab,
          {
            key: spec.key,
            eventKey: spec.key,
            title: /* @__PURE__ */ R.createElement(
              "span",
              {
                className: "refract-tr-tab-title",
                "data-refract-other-scope": otherCount ? "1" : void 0
              },
              TabTitleCounter ? /* @__PURE__ */ R.createElement(
                TabTitleCounter,
                {
                  messageID: spec.messageID,
                  count,
                  abbreviateCounter
                }
              ) : spec.messageID
            )
          },
          List ? /* @__PURE__ */ R.createElement(
            List,
            {
              filterHook: makeTagFilterHook(tag, wide, spec.variant),
              alterQuery: tabKey === spec.key,
              view: spec.view
            }
          ) : null
        );
      })
    ))));
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
  function useEscapeToReturn(active, done) {
    useEffect(() => {
      if (!active) return void 0;
      const onKey = (e) => {
        if (e.key !== "Escape" || e.defaultPrevented) return;
        try {
          if (document.querySelector(EDIT_SELECTOR)) return;
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
  const OWN_TAG_PAGE_KEY = "refract.ownTagPage";
  const TAG_PAGE_DEV_MOUNT_KEY = "refract.tagPageDevMount";
  function readSetting(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function settingIsOn(key) {
    return readSetting(key) === "1";
  }
  function ownTagPageEnabled() {
    return readSetting(OWN_TAG_PAGE_KEY) !== "0";
  }
  function devMountEnabled() {
    return settingIsOn(TAG_PAGE_DEV_MOUNT_KEY);
  }
  const REQUIRED_COMPONENTS = ["TagLink", "TabTitleCounter", "CustomFields"];
  const OWNED_BODY_CLASS = "refract-owned-tag";
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
  const TagRoute = (props) => {
    const { tag, tabKey, next: Next } = props;
    const [mode, setMode] = useState("view");
    const [handedBack, setHandedBack] = useState(false);
    const enabled = ownTagPageEnabled();
    const capable = useCapability();
    const owning = enabled && capable && !handedBack && mode === "view";
    useEffect(() => {
      if (!owning) return void 0;
      announceOnce("owns /tags/" + tag.id);
      setBodyClass(true);
      return () => setBodyClass(false);
    }, [owning, tag.id]);
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
    const handOver = useCallback(() => setMode("stash"), []);
    const returnToView = useCallback(() => setMode("view"), []);
    useReturnFromEdit(mode !== "view", returnToView);
    useEscapeToReturn(mode === "stash", returnToView);
    const fallback = Next ? /* @__PURE__ */ R.createElement(Next, { tag, tabKey }) : null;
    if (!owning) return fallback;
    return /* @__PURE__ */ R.createElement(RefractErrorBoundary, { fallback, onTrip: () => setHandedBack(true) }, /* @__PURE__ */ R.createElement(TagView, { tag, tabKey, onEdit: startEdit, onHandOver: handOver }));
  };
  const TagView = ({ tag, tabKey, onEdit, onHandOver }) => {
    const ui = useUiConfig();
    const children = tag.children || [];
    const nothingOfItsOwn = children.length > 0 && !TAB_SPECS.some((s) => countFor(tag, s, false)) && TAB_SPECS.some((s) => countFor(tag, s, true));
    const [wide, setWide] = useState(
      () => !!ui.showChildTagContent && children.length > 0 || nothingOfItsOwn
    );
    useEffect(() => {
      const was = document.title;
      document.title = tag.name;
      return () => {
        document.title = was;
      };
    }, [tag.name]);
    const [confirming, setConfirming] = useState(false);
    usePageKeybinds({ e: onEdit, "d d": () => setConfirming(true) });
    const activeKey = tabKey && tabKey !== "default" ? tabKey : defaultTabFor(tag, wide);
    const activeSpec = TAB_SPECS.find((s) => s.key === activeKey) || TAB_SPECS[0];
    return /* @__PURE__ */ R.createElement("div", { id: "tag-page", className: "refract-tr" }, /* @__PURE__ */ R.createElement(
      Band,
      {
        tag,
        actions: /* @__PURE__ */ R.createElement(
          ActionBar,
          {
            tag,
            onEdit,
            onHandOver,
            confirming,
            setConfirming
          }
        ),
        scope: {
          childCount: children.length,
          ownCount: countFor(tag, activeSpec, false),
          allCount: countFor(tag, activeSpec, true),
          noun: activeSpec.noun,
          wide,
          onChange: setWide
        }
      }
    ), /* @__PURE__ */ R.createElement(TagTabs, { tag, tabKey, wide }));
  };
  const DEV_CONTAINER_ID = "refract-tag-dev-mount";
  function tagRouteMatch(pathname) {
    const m = /^\/tags\/(\d+)(?:\/([a-z]+))?\/?$/.exec(pathname || "");
    if (!m) return null;
    const tab = m[2];
    return {
      id: m[1],
      tabKey: tab && VALID_TABS.indexOf(tab) >= 0 ? tab : void 0
    };
  }
  const findTagHook = stashService().useFindTag;
  const TagDevMountHost = () => {
    const pathname = useLocationPathname();
    const match = tagRouteMatch(pathname);
    const active = devMountEnabled() && ownTagPageEnabled() && !!match;
    const result = findTagHook ? findTagHook(match ? match.id : "") : void 0;
    const tag = result && result.data && result.data.findTag || null;
    const [container, setContainer] = useState(null);
    const tokenRef = useRef({});
    useEffect(() => {
      if (!active) {
        setContainer(null);
        return void 0;
      }
      const t = window.setInterval(() => {
        const stashPage = document.querySelector(
          "#tag-page:not(.refract-tr)"
        );
        const parent = stashPage ? stashPage.parentElement : null;
        if (!stashPage || !parent) return;
        const holder = parent;
        const claim2 = holder._refractTagClaim;
        const now = Date.now();
        if (claim2 && claim2.token !== tokenRef.current && now - claim2.at < 2e3) return;
        holder._refractTagClaim = { token: tokenRef.current, at: now };
        stashPage.id = "tag-page-stash";
        stashPage.setAttribute("data-refract-tag-dev-hidden", "1");
        let box = document.getElementById(DEV_CONTAINER_ID);
        if (!box || !box.isConnected) {
          box = document.createElement("div");
          box.id = DEV_CONTAINER_ID;
          parent.insertBefore(box, stashPage);
        }
        setContainer((prev) => prev === box ? prev : box);
      }, 300);
      return () => {
        window.clearInterval(t);
        const box = document.getElementById(DEV_CONTAINER_ID);
        if (box && box.parentNode) box.parentNode.removeChild(box);
        const hidden = document.querySelector("[data-refract-tag-dev-hidden]");
        if (hidden) {
          hidden.removeAttribute("data-refract-tag-dev-hidden");
          hidden.id = "tag-page";
        }
      };
    }, [active]);
    if (!active || !container || !tag) return null;
    const api = pluginApi();
    const dom = api && api.ReactDOM;
    if (!dom || typeof dom.createPortal !== "function") {
      warnOnce("development mount needs ReactDOM.createPortal");
      return null;
    }
    return dom.createPortal(
      /* @__PURE__ */ R.createElement(TagRoute, { tag, tabKey: match ? match.tabKey : void 0 }),
      container
    );
  };
  let tagPageIsPatchable = false;
  function register() {
    const api = pluginApi();
    if (!api || !api.patch || typeof api.patch.instead !== "function" || !api.React) {
      window.setTimeout(register, 100);
      return;
    }
    try {
      api.patch.instead("TagPage", function(...args) {
        tagPageIsPatchable = true;
        const next = args.pop();
        const props = args[0];
        if (!props || !props.tag) {
          return R.createElement(next, props);
        }
        return R.createElement(TagRoute, {
          tag: props.tag,
          tabKey: props.tabKey,
          next
        });
      });
    } catch (e) {
      warnOnce("could not patch TagPage", e);
    }
    const instead = api.patch.instead;
    ["HeaderImage", "BackgroundImage"].forEach((point) => {
      try {
        instead(point, function(...args) {
          const next = args.pop();
          const props = args[0] || {};
          return R.createElement(
            R.Fragment,
            null,
            R.createElement(next, props),
            R.createElement(TagDevMountHost, { key: "refract-tag-dev-host" })
          );
        });
      } catch (e) {
        warnOnce("could not patch " + point, e);
      }
    });
    watchForUnpatchableTagPage();
  }
  const TAG_ROUTE = /^\/tags\/\d+(\/|$)/;
  function watchForUnpatchableTagPage() {
    let ticks = 0;
    let onRoute = 0;
    const t = window.setInterval(() => {
      ticks += 1;
      if (tagPageIsPatchable || ticks > 600) {
        window.clearInterval(t);
        return;
      }
      if (!TAG_ROUTE.test(window.location.pathname || "")) {
        onRoute = 0;
        return;
      }
      onRoute += 1;
      if (onRoute < 3) return;
      window.clearInterval(t);
      warnOnce(
        `TagPage not patchable on this Stash, so the theme's tag page is in use. The override point arrives upstream in 3050d900 (PR 6967) and is in no release up to v0.31.1. To look at the owned page here, set localStorage refract.tagPageDevMount to "1" and reload.`
      );
    }, 1e3);
  }
  register();
})();
