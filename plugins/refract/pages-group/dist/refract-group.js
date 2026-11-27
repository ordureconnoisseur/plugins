(function() {
  "use strict";
  const host = window;
  const React = host.PluginApi && host.PluginApi.React;
  if (!React) {
    throw new Error("refract-group: PluginApi.React is not available");
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
  function mousetrap() {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Mousetrap || void 0;
  }
  const announced = {};
  function announceOnce(what) {
    if (announced[what]) return;
    announced[what] = true;
    try {
      console.info("[refract-group] " + what);
    } catch {
    }
  }
  function warnOnce(what, err) {
    if (announced["warn:" + what]) return;
    announced["warn:" + what] = true;
    try {
      if (err === void 0) {
        console.warn("[refract-group] " + what);
      } else {
        console.warn("[refract-group] " + what, err);
      }
    } catch {
    }
  }
  function stashService() {
    const api = pluginApi();
    return api && api.utils && api.utils.StashService || {};
  }
  const groupUpdateHook = stashService().useGroupUpdate;
  const groupDestroyHook = stashService().useGroupDestroy;
  const noopTuple = [
    () => Promise.reject(new Error("refract-group: mutation unavailable")),
    void 0
  ];
  const canUpdateGroup = !!groupUpdateHook;
  const canDestroyGroup = !!groupDestroyHook;
  function useGroupUpdate() {
    if (!groupUpdateHook) return noopTuple;
    return groupUpdateHook();
  }
  function useGroupDestroy(id) {
    if (!groupDestroyHook) return noopTuple;
    return groupDestroyHook({ id });
  }
  const routerLibrary$1 = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.ReactRouterDOM;
  })();
  const useRouterHistory = routerLibrary$1 && routerLibrary$1.useHistory;
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
  const configurationHook = stashService().useConfiguration;
  function useStashUiConfig() {
    const result = configurationHook ? configurationHook() : void 0;
    const data = result && result.data;
    const ui = data && data.configuration && data.configuration.ui;
    return { abbreviateCounters: !!(ui && ui.abbreviateCounters) };
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
  const ActionBar = ({ group, onEdit }) => {
    const [confirming, setConfirming] = useState(false);
    useCancelFocus(confirming);
    const AlertModal = stashComponent("AlertModal");
    usePageKeybinds({ "d d": () => setConfirming(true) });
    const [destroyGroup] = useGroupDestroy(group.id);
    const history = useHistory();
    const confirmDelete = useCallback(() => {
      setConfirming(false);
      if (!canDestroyGroup) return;
      destroyGroup().then(() => history.push("/groups")).catch((e) => warnOnce("could not delete group", e));
    }, [destroyGroup, history]);
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-action-row" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "btn btn-primary refract-gr-edit", onClick: onEdit }, "Edit"), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn refract-gr-delete",
        onClick: () => setConfirming(true),
        disabled: !canDestroyGroup
      },
      "Delete"
    ), AlertModal ? /* @__PURE__ */ R.createElement(
      AlertModal,
      {
        show: confirming,
        text: "Delete " + group.name + "?",
        confirmVariant: "danger",
        confirmButtonText: "Delete",
        onConfirm: confirmDelete,
        onCancel: () => setConfirming(false)
      }
    ) : null);
  };
  const RefreshIcon = () => /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 512 512", fill: "currentColor", "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ R.createElement("path", { d: "M463.5 224l8.5 0c13.3 0 24-10.7 24-24l0-128c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8l119.5 0z" }));
  function runningTime(seconds) {
    const s = Math.round(Number(seconds) || 0);
    if (!s || s < 0) return null;
    const h = Math.floor(s / 3600);
    const m = Math.floor(s % 3600 / 60);
    const sec = s % 60;
    const two = (n) => n < 10 ? "0" + n : String(n);
    const exact = h ? h + ":" + two(m) + ":" + two(sec) : two(m) + ":" + two(sec);
    const short = h ? h + " h " + two(m) : m + " min";
    return { short, exact };
  }
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  function releaseDate(date) {
    const raw = (date || "").trim();
    if (!raw) return null;
    const parts = raw.split("-");
    const y = parseInt(parts[0], 10);
    if (!y || y < 1e3) return { short: raw, full: raw };
    const mo = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    const d = parts.length > 2 ? parseInt(parts[2], 10) : 0;
    if (!mo) return { short: String(y), full: String(y) };
    const month = MONTHS[mo - 1] || String(mo);
    if (!d) return { short: month.slice(0, 3) + " " + y, full: month + " " + y };
    return { short: d + " " + month.slice(0, 3) + " " + y, full: d + " " + month + " " + y };
  }
  function plain(v) {
    const s = (v || "").trim();
    return s ? s : null;
  }
  function counted(n) {
    const v = Number(n);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  function num(n) {
    try {
      return n.toLocaleString();
    } catch {
      return String(n);
    }
  }
  function realImage(path) {
    const p = (path || "").trim();
    if (!p) return null;
    if (p.indexOf("default=true") !== -1) return null;
    return p;
  }
  const HALF_TURN_MS = 200;
  function prefersReducedMotion() {
    try {
      return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }
  const Sleeve = ({ group }) => {
    const front = realImage(group.front_image_path);
    const back = realImage(group.back_image_path);
    const [face, setFace] = useState("front");
    const [turning, setTurning] = useState(false);
    const timers = useRef([]);
    useEffect(() => {
      return () => {
        timers.current.forEach((t) => window.clearTimeout(t));
        timers.current = [];
      };
    }, []);
    useEffect(() => {
      if (!back && face === "back") setFace("front");
    }, [back, face]);
    const flip = useCallback(() => {
      if (!back) return;
      if (prefersReducedMotion()) {
        setFace((f) => f === "front" ? "back" : "front");
        return;
      }
      setTurning(true);
      timers.current.push(
        window.setTimeout(() => setFace((f) => f === "front" ? "back" : "front"), HALF_TURN_MS)
      );
      timers.current.push(window.setTimeout(() => setTurning(false), HALF_TURN_MS + 20));
    }, [back]);
    const LightboxLink = stashComponent("LightboxLink");
    const images = [];
    if (front) images.push({ paths: { thumbnail: front, image: front } });
    if (back) images.push({ paths: { thumbnail: back, image: back } });
    if (!front && !back) return null;
    const src = face === "back" && back ? back : front || back;
    const index = face === "back" && back ? images.length - 1 : 0;
    const plate = /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-gr-sleeve-plate" + (turning ? " is-turning" : "") + (face === "back" ? " is-back" : "")
      },
      /* @__PURE__ */ R.createElement(
        "img",
        {
          className: "refract-gr-sleeve-face",
          src,
          alt: face === "back" ? "Back cover" : "Front cover"
        }
      )
    );
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-sleeve" }, LightboxLink ? /* @__PURE__ */ R.createElement(LightboxLink, { images, index }, plate) : plate, back && front ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-gr-sleeve-flip",
        onClick: flip,
        "aria-pressed": face === "back",
        "aria-label": face === "back" ? "Show front cover" : "Show back cover"
      },
      /* @__PURE__ */ R.createElement(RefreshIcon, null),
      /* @__PURE__ */ R.createElement("span", null, face === "back" ? "Front" : "Back")
    ) : null);
  };
  const routerLibrary = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.ReactRouterDOM;
  })();
  const StashLink = routerLibrary && routerLibrary.Link;
  const RouteLink = ({ to, className, title, children }) => {
    if (StashLink) {
      return /* @__PURE__ */ R.createElement(StashLink, { to, className, title }, children);
    }
    return /* @__PURE__ */ R.createElement("a", { href: to, className, title }, children);
  };
  function navUtils() {
    const api = pluginApi();
    return api && api.utils && api.utils.NavUtils || {};
  }
  function buildTiles(group) {
    const t = [];
    const push = (key, label, value) => {
      if (value === null || value === void 0 || value === "") return;
      t.push({ key, label, value });
    };
    if (group.studio && group.studio.id) {
      push(
        "studio",
        "Studio",
        /* @__PURE__ */ R.createElement(RouteLink, { className: "refract-gr-link", to: "/studios/" + group.studio.id }, group.studio.name)
      );
    }
    const director = plain(group.director);
    if (director) {
      const make = navUtils().makeDirectorGroupsUrl;
      let href = null;
      try {
        href = make ? make(director) : null;
      } catch {
        href = null;
      }
      push(
        "director",
        "Director",
        href && href !== "#" ? /* @__PURE__ */ R.createElement(RouteLink, { className: "refract-gr-link", to: href }, director) : director
      );
    }
    const parents = (group.containing_groups || []).filter((c) => c && c.group && c.group.id);
    if (parents.length) {
      push(
        "containing_groups",
        parents.length === 1 ? "Part of" : "Part of",
        /* @__PURE__ */ R.createElement("ul", { className: "refract-gr-parent-list" }, parents.map((c) => /* @__PURE__ */ R.createElement("li", { key: c.group.id }, /* @__PURE__ */ R.createElement(RouteLink, { className: "refract-gr-link", to: "/groups/" + c.group.id }, c.group.name), plain(c.description) ? /* @__PURE__ */ R.createElement("span", { className: "refract-gr-tile-tail" }, " ", c.description) : null)))
      );
    }
    const o = counted(group.o_counter);
    if (o) push("o_counter", "O count", num(o));
    return t;
  }
  function hasCustomFields(values) {
    return !!values && Object.keys(values).length > 0;
  }
  const ReadoutGrid = ({ group, extension }) => {
    const tiles = buildTiles(group);
    if (!tiles.length && !hasCustomFields(group.custom_fields)) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-grid" }, tiles.map((tile) => /* @__PURE__ */ R.createElement("div", { className: "refract-gr-tile refract-gr-tile-" + tile.key, key: tile.key }, /* @__PURE__ */ R.createElement("span", { className: "refract-gr-tile-label" }, tile.label), /* @__PURE__ */ R.createElement("span", { className: "refract-gr-tile-value" }, tile.value))), extension);
  };
  const Synopsis = ({ synopsis }) => {
    const text = (synopsis || "").trim();
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
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-synopsis" + (open ? " is-open" : "") }, /* @__PURE__ */ R.createElement("span", { className: "refract-gr-tile-label" }, "Synopsis"), /* @__PURE__ */ R.createElement("p", { className: "refract-gr-synopsis-body", ref: bodyRef }, text), clipped || open ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-gr-more",
        onClick: () => setOpen(!open),
        "aria-expanded": open
      },
      open ? "Less" : "More"
    ) : null);
  };
  const AliasLine = ({ aliases }) => {
    const text = plain(aliases);
    if (!text) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-alias" }, text);
  };
  const TagRow = ({ group }) => {
    const TagLink = stashComponent("TagLink");
    const tags = group.tags || [];
    if (!TagLink || !tags.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-tags" }, /* @__PURE__ */ R.createElement("span", { className: "refract-gr-tile-label" }, "Tags"), /* @__PURE__ */ R.createElement("div", { className: "refract-gr-tag-list" }, tags.map((tag) => /* @__PURE__ */ R.createElement(TagLink, { key: tag.id, tag, linkType: "group" }))));
  };
  const Notes = ({ group }) => {
    const synopsis = plain(group.synopsis);
    const hasTags = !!(group.tags && group.tags.length);
    if (!synopsis && !hasTags) return null;
    return /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-gr-notes",
        "data-refract-pair": synopsis && hasTags ? "1" : void 0
      },
      /* @__PURE__ */ R.createElement(Synopsis, { synopsis }),
      /* @__PURE__ */ R.createElement(TagRow, { group })
    );
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
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-extension" }, island);
  };
  const Band = ({ group, actions, standing, quality, children }) => {
    const ExternalLinkButtons = stashComponent("ExternalLinkButtons");
    const shot = realImage(group.front_image_path) || realImage(group.back_image_path);
    const hasSleeve = !!shot;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-band", "data-refract-sleeve": hasSleeve ? "1" : void 0 }, /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-gr-fill",
        "data-shot": shot ? "1" : void 0,
        style: shot ? {
          "--refract-gr-shot": 'url("' + shot.replace(/"/g, "%22") + '")'
        } : void 0,
        "aria-hidden": "true"
      },
      /* @__PURE__ */ R.createElement("div", { className: "refract-gr-blur" }),
      /* @__PURE__ */ R.createElement("div", { className: "refract-gr-veil" })
    ), /* @__PURE__ */ R.createElement(Sleeve, { group }), /* @__PURE__ */ R.createElement("div", { className: "refract-gr-head" }, /* @__PURE__ */ R.createElement("h2", { className: "refract-gr-title" }, /* @__PURE__ */ R.createElement("span", { className: "refract-gr-name" }, group.name), /* @__PURE__ */ R.createElement("span", { className: "refract-gr-name-icons name-icons" }, ExternalLinkButtons ? /* @__PURE__ */ R.createElement(ExternalLinkButtons, { urls: group.urls || void 0 }) : null)), actions ? /* @__PURE__ */ R.createElement("div", { className: "refract-gr-actions" }, actions) : null, /* @__PURE__ */ R.createElement(AliasLine, { aliases: group.aliases }), standing, quality, children));
  };
  const StandingRow = ({ group }) => {
    const cells = [];
    const scenes = counted(group.scene_count);
    const scenesAll = counted(group.scene_count_all);
    if (group.scene_count != null) {
      cells.push({
        label: "Scenes",
        value: num(scenes),
        tail: scenesAll > scenes ? "of " + num(scenesAll) + " including sub-groups" : void 0
      });
    }
    const run = runningTime(group.duration);
    if (run) {
      cells.push({ label: "Running time", value: run.short, title: run.exact });
    }
    const date = releaseDate(group.date);
    if (date) {
      cells.push({ label: "Released", value: date.short, title: date.full });
    }
    const subs = counted(group.sub_group_count);
    const subsAll = counted(group.sub_group_count_all);
    if (subs) {
      cells.push({
        /* Stash calls these sub-groups, on the tab and in its own
           Add and Remove actions, so this page calls them that too.
           One vocabulary per page (DESIGN_SYSTEM 6.21). */
        label: "Sub-groups",
        value: num(subs),
        tail: subsAll > subs ? "of " + num(subsAll) + " including nested" : void 0
      });
    }
    if (!cells.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-standing" }, cells.map((c) => /* @__PURE__ */ R.createElement("div", { className: "refract-gr-standing-cell", key: c.label }, /* @__PURE__ */ R.createElement("span", { className: "refract-gr-standing-label" }, c.label), /* @__PURE__ */ R.createElement("span", { className: "refract-gr-standing-value", title: c.title }, c.value, c.tail ? /* @__PURE__ */ R.createElement("span", { className: "refract-gr-standing-tail" }, " ", c.tail) : null))));
  };
  const QualityGroup = ({ group }) => {
    const RatingSystem = stashComponent("RatingSystem");
    const [updateGroup] = useGroupUpdate();
    const setRating = useCallback(
      (value) => {
        if (!canUpdateGroup) return;
        updateGroup({
          variables: { input: { id: group.id, rating100: value } }
        }).catch((e) => warnOnce("could not set rating", e));
      },
      [group.id, updateGroup]
    );
    useRatingKeybinds(setRating);
    if (!RatingSystem) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "quality-group" }, /* @__PURE__ */ R.createElement(
      RatingSystem,
      {
        value: group.rating100,
        onSetRating: setRating,
        clickToRate: true,
        withoutContext: true,
        disabled: !canUpdateGroup
      }
    ));
  };
  const VALID_TABS = ["default", "scenes", "performers", "subgroups"];
  const bootstrap = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Bootstrap;
  })();
  const INCLUDES = (() => {
    const api = pluginApi();
    const gql = api && api.GQL;
    return gql && gql.CriterionModifier && gql.CriterionModifier.Includes || "INCLUDES";
  })();
  function useGroupFilterHook(group) {
    return useMemo(() => {
      return (filter) => {
        const value = { id: group.id, label: group.name };
        let criterion = filter.criteria.find(
          (c) => c.criterionOption && c.criterionOption.type === "groups"
        );
        if (!criterion) {
          criterion = filter.makeCriterion("groups");
          filter.criteria.push(criterion);
        }
        criterion.value = { items: [value], excluded: [], depth: 0 };
        criterion.modifier = INCLUDES;
        return filter;
      };
    }, [group.id, group.name]);
  }
  const GroupTabs = ({ group, tabKey, baseUrl }) => {
    const base = baseUrl || "/groups/" + group.id;
    const history = useHistory();
    const { abbreviateCounters } = useStashUiConfig();
    const filterHook = useGroupFilterHook(group);
    const TabTitleCounter = stashComponent("TabTitleCounter");
    const sceneCount = counted(group.scene_count);
    const performerCount = counted(group.performer_count);
    const subGroupCount = counted(group.sub_group_count);
    const defaultTabKey = useMemo(() => {
      if (sceneCount === 0) {
        if (performerCount !== 0) return "performers";
        if (subGroupCount !== 0) return "subgroups";
      }
      return "scenes";
    }, [sceneCount, performerCount, subGroupCount]);
    const setTabKey = useCallback(
      (next) => {
        const key = next || defaultTabKey;
        if (key === tabKey) return;
        if (VALID_TABS.indexOf(key) < 0) return;
        history.replace(base + "/" + key);
      },
      [defaultTabKey, tabKey, history, base]
    );
    useEffect(() => {
      if (!tabKey || tabKey === "default") setTabKey(defaultTabKey);
    }, [setTabKey, defaultTabKey, tabKey]);
    const activeKey = tabKey && tabKey !== "default" ? tabKey : defaultTabKey;
    const Tabs = bootstrap && bootstrap.Tabs;
    const Tab = bootstrap && bootstrap.Tab;
    const FilteredSceneList = stashComponent("FilteredSceneList");
    const FilteredPerformerList = stashComponent("FilteredPerformerList");
    const SubGroupsPanel = stashComponent(
      "GroupSubGroupsPanel"
    );
    if (!Tabs || !Tab) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-tabs detail-body" }, /* @__PURE__ */ R.createElement("div", { className: "group-body" }, /* @__PURE__ */ R.createElement("div", { className: "group-tabs" }, /* @__PURE__ */ R.createElement(
      Tabs,
      {
        id: "group-tabs",
        mountOnEnter: true,
        unmountOnExit: true,
        activeKey,
        onSelect: setTabKey
      },
      /* @__PURE__ */ R.createElement(
        Tab,
        {
          eventKey: "scenes",
          title: TabTitleCounter ? /* @__PURE__ */ R.createElement(
            TabTitleCounter,
            {
              messageID: "scenes",
              count: sceneCount,
              abbreviateCounter: abbreviateCounters
            }
          ) : "Scenes"
        },
        FilteredSceneList ? /* @__PURE__ */ R.createElement(
          FilteredSceneList,
          {
            filterHook,
            defaultSort: "group_scene_number",
            alterQuery: activeKey === "scenes",
            view: "group_scenes",
            fromGroupId: group.id
          }
        ) : null
      ),
      /* @__PURE__ */ R.createElement(
        Tab,
        {
          eventKey: "performers",
          title: TabTitleCounter ? /* @__PURE__ */ R.createElement(
            TabTitleCounter,
            {
              messageID: "performers",
              count: performerCount,
              abbreviateCounter: abbreviateCounters
            }
          ) : "Performers"
        },
        FilteredPerformerList ? /* @__PURE__ */ R.createElement(
          FilteredPerformerList,
          {
            filterHook,
            alterQuery: activeKey === "performers",
            view: "group_performers"
          }
        ) : null
      ),
      /* @__PURE__ */ R.createElement(
        Tab,
        {
          eventKey: "subgroups",
          title: TabTitleCounter ? /* @__PURE__ */ R.createElement(
            TabTitleCounter,
            {
              messageID: "sub_groups",
              count: subGroupCount,
              abbreviateCounter: abbreviateCounters
            }
          ) : "Sub-groups"
        },
        SubGroupsPanel ? /* @__PURE__ */ R.createElement(SubGroupsPanel, { active: activeKey === "subgroups", group }) : null
      )
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
  const OWN_GROUP_PAGE_KEY = "refract.ownGroupPage";
  function readSetting(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function ownGroupPageEnabled() {
    return readSetting(OWN_GROUP_PAGE_KEY) !== "0";
  }
  const REQUIRED_COMPONENTS = [
    "RatingSystem",
    "CustomFields",
    "TagLink",
    "TabTitleCounter",
    "ExternalLinkButtons",
    "LightboxLink",
    "FilteredSceneList",
    "FilteredPerformerList",
    "GroupSubGroupsPanel"
  ];
  const OWNED_BODY_CLASS = "refract-owned-group";
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
  const GroupRoute = (props) => {
    const { group, tabKey, next: Next, baseUrl } = props;
    const [mode, setMode] = useState("view");
    const [handedBack, setHandedBack] = useState(false);
    const enabled = ownGroupPageEnabled();
    const capable = useCapability();
    const owning = enabled && capable && !handedBack && mode === "view";
    useEffect(() => {
      if (!owning) return void 0;
      announceOnce("owns /groups/" + group.id);
      setBodyClass(true);
      return () => setBodyClass(false);
    }, [owning, group.id]);
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
    const returnToView = useCallback(() => setMode("view"), []);
    useReturnFromEdit(mode !== "view", returnToView);
    usePageKeybinds({ e: startEdit }, owning);
    const fallback = /* @__PURE__ */ R.createElement(Next, { group, tabKey });
    if (!owning) return fallback;
    return /* @__PURE__ */ R.createElement(RefractErrorBoundary, { fallback, onTrip: () => setHandedBack(true) }, /* @__PURE__ */ R.createElement(GroupView, { group, tabKey, baseUrl, onEdit: startEdit }));
  };
  const GroupView = ({ group, tabKey, baseUrl, onEdit }) => {
    useEffect(() => {
      const was = document.title;
      document.title = group.name;
      return () => {
        document.title = was;
      };
    }, [group.name]);
    return /* @__PURE__ */ R.createElement("div", { id: "group-page", className: "refract-gr" }, /* @__PURE__ */ R.createElement(
      Band,
      {
        group,
        standing: /* @__PURE__ */ R.createElement(StandingRow, { group }),
        quality: /* @__PURE__ */ R.createElement(QualityGroup, { group }),
        actions: /* @__PURE__ */ R.createElement(ActionBar, { group, onEdit })
      },
      /* @__PURE__ */ R.createElement(
        ReadoutGrid,
        {
          group,
          extension: /* @__PURE__ */ R.createElement(ExtensionSlot, { customFields: group.custom_fields })
        }
      ),
      /* @__PURE__ */ R.createElement(Notes, { group })
    ), /* @__PURE__ */ R.createElement(GroupTabs, { group, tabKey, baseUrl }));
  };
  const DEV_MOUNT_KEY = "refract.devGroupMount";
  const DEV_MOUNT_PATH = "/refract-group/:id/:tab?";
  function devMountEnabled() {
    try {
      return window.localStorage.getItem(DEV_MOUNT_KEY) === "1";
    } catch {
      return false;
    }
  }
  const CHUNKS = ["Groups", "Scenes", "Performers"];
  function useChunks() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
      let live = true;
      const api = pluginApi();
      const utils = api && api.utils;
      const lc = api && api.loadableComponents || {};
      const loaders = CHUNKS.map((n) => lc[n]).filter(Boolean);
      if (!utils || !utils.loadComponents || !loaders.length) {
        setReady(true);
        return void 0;
      }
      utils.loadComponents(loaders).catch(() => void 0).then(() => {
        if (live) setReady(true);
      });
      return () => {
        live = false;
      };
    }, []);
    return ready;
  }
  const NoFallback = ({ group }) => /* @__PURE__ */ R.createElement("div", { className: "refract-gr-devnote" }, /* @__PURE__ */ R.createElement("p", null, "Refract stood down for group ", group.id, ". On a real group page Stash's own component renders here; this development mount has none to hand back to."));
  const DevGroupMount = (props) => {
    const api = pluginApi();
    const svc = api && api.utils && api.utils.StashService || {};
    const params = props.match && props.match.params || {};
    const id = params.id || "";
    const LoadingIndicator = stashComponent("LoadingIndicator");
    const chunksReady = useChunks();
    const result = svc.useFindGroup ? svc.useFindGroup(id) : void 0;
    if (!svc.useFindGroup) {
      return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-devnote" }, "This Stash has no useFindGroup to load from.");
    }
    if (!chunksReady || result && result.loading) {
      return LoadingIndicator ? /* @__PURE__ */ R.createElement(LoadingIndicator, null) : /* @__PURE__ */ R.createElement("div", { className: "refract-gr-devnote" }, "Loading…");
    }
    if (result && result.error) {
      return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-devnote" }, result.error.message);
    }
    const group = result && result.data && result.data.findGroup;
    if (!group) {
      return /* @__PURE__ */ R.createElement("div", { className: "refract-gr-devnote" }, "No group found with id ", id, ".");
    }
    return /* @__PURE__ */ R.createElement(
      GroupRoute,
      {
        group,
        tabKey: params.tab,
        baseUrl: "/refract-group/" + id,
        next: NoFallback
      }
    );
  };
  function register() {
    const api = pluginApi();
    if (!api || !api.patch || typeof api.patch.instead !== "function" || !api.React) {
      window.setTimeout(register, 100);
      return;
    }
    try {
      api.patch.instead("GroupPage", function(...args) {
        const next = args.pop();
        const props = args[0];
        if (!props || !props.group) {
          return R.createElement(next, props);
        }
        return R.createElement(GroupRoute, {
          group: props.group,
          tabKey: props.tabKey,
          next
        });
      });
    } catch (e) {
      warnOnce("could not patch GroupPage", e);
    }
    registerDevMount();
    watchForUnpatchableGroupPage();
  }
  function registerDevMount() {
    if (!devMountEnabled()) return;
    const api = pluginApi();
    const route = api && api.register && api.register.route;
    if (typeof route !== "function") return;
    try {
      route(DEV_MOUNT_PATH, DevGroupMount);
      console.info("[refract-group] development mount at " + DEV_MOUNT_PATH);
    } catch (e) {
      warnOnce("could not register the development mount", e);
    }
  }
  function watchForUnpatchableGroupPage() {
    let ticks = 0;
    const t = window.setInterval(() => {
      ticks += 1;
      const chunkLoaded = !!stashComponent("GroupSubGroupsPanel");
      if (!chunkLoaded) {
        if (ticks > 120) window.clearInterval(t);
        return;
      }
      window.clearInterval(t);
      if (stashComponent("GroupPage")) return;
      warnOnce(
        `GroupPage not patchable on this Stash, so the theme's group page is in use. The override point arrives upstream in 3050d900 (PR 6967) and is in no release up to v0.31.1. To look at the owned page here, set localStorage refract.devGroupMount to "1" and open /refract-group/<id>.`
      );
    }, 1e3);
  }
  register();
})();
