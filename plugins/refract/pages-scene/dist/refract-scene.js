(function() {
  "use strict";
  const host$1 = window;
  const React = host$1.PluginApi && host$1.PluginApi.React;
  if (!React) {
    throw new Error("refract-scene: PluginApi.React is not available");
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
    throw new Error("refract-scene: PluginApi.ReactDOM is not available");
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
      console.info("[refract-scene] " + what);
    } catch {
    }
  }
  function warnOnce(what, err) {
    if (announced["warn:" + what]) return;
    announced["warn:" + what] = true;
    try {
      if (err === void 0) console.warn("[refract-scene] " + what);
      else console.warn("[refract-scene] " + what, err);
    } catch {
    }
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
  const OWN_SCENE_PAGE_KEY = "refract.ownScenePage";
  const HIDE_SCENE_META_KEY = "refract.hideSceneMeta";
  function readSetting(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function settingWithDefault(key, dflt) {
    const v = readSetting(key);
    if (v === null || v === "") return dflt;
    return v === "1";
  }
  function ownScenePageEnabled() {
    return readSetting(OWN_SCENE_PAGE_KEY) !== "0";
  }
  function bodyHasClass(cls) {
    try {
      return !!document.body && document.body.classList.contains(cls);
    } catch {
      return false;
    }
  }
  const HIDE_SCENE_META_CLASS = "refract-hide-scene-meta";
  function sceneMetaHidden() {
    return bodyHasClass(HIDE_SCENE_META_CLASS) || settingWithDefault(HIDE_SCENE_META_KEY, false);
  }
  const classListeners = [];
  let classObserver = null;
  function onBodyClassChange(fn) {
    classListeners.push(fn);
    if (!classObserver && typeof MutationObserver !== "undefined") {
      try {
        classObserver = new MutationObserver(() => {
          for (const l of classListeners.slice()) l();
        });
        classObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ["class"]
        });
      } catch {
        classObserver = null;
      }
    }
    return () => {
      const i = classListeners.indexOf(fn);
      if (i >= 0) classListeners.splice(i, 1);
      if (!classListeners.length && classObserver) {
        classObserver.disconnect();
        classObserver = null;
      }
    };
  }
  const RouterLink = (() => {
    const api = pluginApi();
    const lib = api && api.libraries && api.libraries.ReactRouterDOM;
    return lib && lib.Link;
  })();
  const AppLink = ({ to, className, title, children }) => {
    if (RouterLink) {
      return /* @__PURE__ */ R.createElement(RouterLink, { to, className, title }, children);
    }
    return /* @__PURE__ */ R.createElement("a", { href: to, className, title }, children);
  };
  function fileNameFromPath(path) {
    if (!path) return "";
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || "";
  }
  function sceneTitle(scene) {
    if (scene.title) return scene.title;
    if (scene.files && scene.files.length > 0) {
      return fileNameFromPath(scene.files[0].path || "");
    }
    return "";
  }
  function scenePath(scene) {
    if (scene.files && scene.files.length > 0) return scene.files[0].path || "";
    return "";
  }
  function primaryFile(scene) {
    return scene.files && scene.files.length > 0 ? scene.files[0] : void 0;
  }
  let counter;
  function formatCount(n) {
    if (counter === void 0) {
      try {
        counter = new Intl.NumberFormat(void 0);
      } catch {
        counter = null;
      }
    }
    try {
      return counter ? counter.format(n) : String(n);
    } catch {
      return String(n);
    }
  }
  function resolutionLabel(width, height) {
    if (!width || !height) return "";
    const shortest = Math.min(width, height);
    if (shortest >= 6144) return "8K";
    if (shortest >= 3840) return "HUGE";
    if (shortest >= 3584) return "4K";
    if (shortest >= 2880) return "5K";
    if (shortest >= 2160) return "4K";
    if (shortest >= 1440) return "1440p";
    if (shortest >= 1080) return "1080p";
    if (shortest >= 720) return "720p";
    if (shortest >= 540) return "540p";
    if (shortest >= 480) return "480p";
    if (shortest >= 360) return "360p";
    if (shortest >= 240) return "240p";
    if (shortest >= 144) return "144p";
    return "";
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
  function stashService() {
    const api = pluginApi();
    return api && api.utils && api.utils.StashService || {};
  }
  const svc = stashService();
  const sceneUpdateHook = svc.useSceneUpdate;
  const incrementOHook = svc.useSceneIncrementO;
  const incrementPlayHook = svc.useSceneIncrementPlayCount;
  const generateScreenshotHook = svc.useSceneGenerateScreenshot;
  function unavailable() {
    return Promise.reject(new Error("refract-scene: mutation unavailable"));
  }
  const noopTuple = [unavailable, void 0];
  function useSceneUpdate() {
    if (!sceneUpdateHook) return noopTuple;
    return sceneUpdateHook();
  }
  function useSceneIncrementO(id) {
    if (!incrementOHook) return noopTuple;
    return incrementOHook(id);
  }
  function useSceneIncrementPlayCount() {
    if (!incrementPlayHook) return noopTuple;
    return incrementPlayHook();
  }
  function useSceneGenerateScreenshot() {
    if (!generateScreenshotHook) {
      return noopTuple;
    }
    return generateScreenshotHook();
  }
  function metadataScan(input) {
    const fn = svc.mutateMetadataScan;
    if (!fn) return unavailable();
    return fn(input);
  }
  const configurationHook = svc.useConfiguration;
  function useStashConfiguration() {
    const result = configurationHook ? configurationHook() : void 0;
    const data = result && result.data;
    const conf = data && data.configuration;
    return {
      ui: conf && conf.ui || {},
      sfwContentMode: !!(conf && conf.interface && conf.interface.sfwContentMode),
      stashBoxes: conf && conf.general && conf.general.stashBoxes || []
    };
  }
  const routerLibrary = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.ReactRouterDOM;
  })();
  routerLibrary && routerLibrary.useHistory;
  const useToastHook = (() => {
    const api = pluginApi();
    return api && api.hooks && api.hooks.useToast;
  })();
  const noToast = { success: () => void 0, error: () => void 0 };
  function useToast() {
    if (!useToastHook) return noToast;
    return useToastHook();
  }
  function useRatingSystemOptions() {
    const result = configurationHook ? configurationHook() : void 0;
    const data = result && result.data;
    const ui = data && data.configuration && data.configuration.ui;
    return ui && ui.ratingSystemOptions || {};
  }
  const Marquee = ({
    scene,
    title
  }) => {
    const { ui } = useStashConfiguration();
    const TruncatedText = stashComponent("TruncatedText");
    const file = primaryFile(scene);
    const studio = scene.studio;
    const wantsBanner = bodyHasClass("refract-studio-banner") && !ui.showStudioText;
    const logo = studio && studio.image_path && !/default=true$/.test(studio.image_path) ? studio.image_path : void 0;
    const resolution = resolutionLabel(file && file.width, file && file.height);
    const frameRate = file && file.frame_rate ? Math.round(file.frame_rate * 100) / 100 : 0;
    const specs = [];
    if (scene.date) {
      specs.push(
        /* @__PURE__ */ R.createElement("span", { className: "refract-sp-date", key: "date", "data-value": scene.date }, formatDate(scene.date))
      );
    }
    if (frameRate) {
      specs.push(
        /* @__PURE__ */ R.createElement("span", { className: "refract-sp-fps", key: "fps", "data-value": frameRate }, frameRate, " fps")
      );
    }
    if (resolution) {
      specs.push(
        /* @__PURE__ */ R.createElement("span", { className: "refract-sp-res", key: "res", "data-value": resolution }, resolution)
      );
    }
    return /* @__PURE__ */ R.createElement("header", { className: "refract-sp-head" }, studio ? /* @__PURE__ */ R.createElement(
      AppLink,
      {
        to: "/studios/" + studio.id,
        className: "refract-sp-studio",
        title: studio.name
      },
      wantsBanner && logo ? /* @__PURE__ */ R.createElement("img", { src: logo, alt: studio.name, className: "refract-sp-studio-logo" }) : studio.name
    ) : null, /* @__PURE__ */ R.createElement(
      "h1",
      {
        className: "refract-sp-title" + (studio ? "" : " refract-sp-title-lead"),
        title
      },
      TruncatedText ? /* @__PURE__ */ R.createElement(TruncatedText, { text: title, lineCount: 2 }) : title
    ), /* @__PURE__ */ R.createElement("h3", { className: "scene-header refract-sp-hook", "aria-hidden": "true" }, title), specs.length ? /* @__PURE__ */ R.createElement("p", { className: "refract-sp-specs" }, specs.map((s, i) => /* @__PURE__ */ R.createElement(R.Fragment, { key: i }, i > 0 ? /* @__PURE__ */ R.createElement("span", { className: "refract-sp-sep", "aria-hidden": "true" }) : null, s))) : null);
  };
  function formatDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!m) return value;
    try {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return new Intl.DateTimeFormat(void 0, {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(d);
    } catch {
      return value;
    }
  }
  const cache = {};
  const pending = {};
  function loadableAvailable(name) {
    const api = pluginApi();
    const l = api && api.loadableComponents;
    return !!(l && typeof l[name] === "function");
  }
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
  function useLoadablePanel(name) {
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
  function warmScenePanels() {
    const names = [
      "SceneFileInfoPanel",
      "TagLink",
      "PerformerCard",
      "SceneDetailPanel",
      "SceneMarkersPanel",
      "SceneHistoryPanel",
      "SceneGroupPanel",
      "SceneGalleriesPanel",
      "SceneVideoFilterPanel",
      "QueueViewer",
      "ExternalPlayerButton"
    ];
    for (const n of names) {
      if (loadableAvailable(n)) loadPanel(n);
    }
  }
  const fa = (() => {
    const api = pluginApi();
    const libs = api && api.libraries;
    return libs && libs.FontAwesomeSolid || void 0;
  })();
  function icon(name) {
    return fa ? fa[name] : void 0;
  }
  const faEye = icon("faEye");
  const faThumbsUp = icon("faThumbsUp");
  const faBox = icon("faBox");
  const faEllipsisV = icon("faEllipsisV");
  icon("faChevronDown");
  const PLAYER_ID = "VideoJsPlayer";
  function getPlayer() {
    try {
      const vjs = window.videojs;
      if (vjs && typeof vjs.getPlayer === "function") {
        const p = vjs.getPlayer(PLAYER_ID);
        if (p) return p;
      }
      const el = document.getElementById(PLAYER_ID);
      if (el && el.player) return el.player;
    } catch {
    }
    return void 0;
  }
  function getPlayerPosition() {
    const p = getPlayer();
    if (p && typeof p.currentTime === "function") {
      const t = p.currentTime();
      if (typeof t === "number" && isFinite(t)) return t;
    }
    try {
      const v = document.querySelector(
        "#" + PLAYER_ID + " video"
      );
      if (v && isFinite(v.currentTime)) return v.currentTime;
    } catch {
    }
    return void 0;
  }
  function getAbLoopPlugin() {
    const p = getPlayer();
    return p && p.abLoopPlugin || null;
  }
  const THEME_TRANSIENT_CHROME = ".st-op-menu-overlay";
  const THEME_OP_MENU_ITEM = ".st-op-menu-item";
  function removeThemeChrome(root) {
    let n = 0;
    try {
      const gone = root.querySelectorAll(THEME_TRANSIENT_CHROME);
      for (let i = 0; i < gone.length; i += 1) {
        const el = gone[i];
        if (el.parentNode) {
          el.parentNode.removeChild(el);
          n += 1;
        }
      }
    } catch {
    }
    return n;
  }
  const MORE_LABEL = "More";
  const LESS_LABEL = "Less";
  const TAB_DETAILS = "scene-details-panel";
  const TAB_QUEUE = "scene-queue-panel";
  const TAB_MARKERS = "scene-markers-panel";
  const TAB_GROUP = "scene-group-panel";
  const TAB_GALLERIES = "scene-galleries-panel";
  const TAB_FILTER = "scene-video-filter-panel";
  const TAB_FILE_INFO = "scene-file-info-panel";
  const TAB_HISTORY = "scene-history-panel";
  const TAB_EDIT = "scene-edit-panel";
  const OWNED_BODY_CLASS = "refract-owned-scene";
  const OPERATION_MENU_ID = "operation-menu";
  const ControlStrip = ({ scene, ops, onHandOver }) => {
    const { ui, sfwContentMode } = useStashConfiguration();
    const starsMode = (ui.ratingSystemOptions && ui.ratingSystemOptions.type) !== "decimal";
    const [ratingOpen, setRatingOpen] = useState(false);
    const RatingSystem = stashComponent("RatingSystem");
    const ExternalPlayer = useLoadablePanel("ExternalPlayerButton");
    const toggleRating = useCallback(() => {
      setRatingOpen((was) => {
        const next = !was;
        try {
          const trigger = document.querySelector(
            ".scene-toolbar .adv-rating-btn"
          );
          if (trigger) {
            const panel = document.querySelector(".adv-rating-inline-panel");
            const panelOpen = !!(panel && panel.classList.contains("open"));
            if (panelOpen !== next) trigger.click();
          }
        } catch {
        }
        return next;
      });
    }, []);
    return /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "scene-toolbar refract-sp-strip" + (ratingOpen ? " st-rating-open" : "")
      },
      /* @__PURE__ */ R.createElement(
        TierChip,
        {
          rating100: scene.rating100,
          starsMode,
          open: ratingOpen,
          onToggle: toggleRating
        }
      ),
      /* @__PURE__ */ R.createElement("span", { className: "scene-toolbar-group" }, RatingSystem ? /* @__PURE__ */ R.createElement(
        RatingSystem,
        {
          value: scene.rating100,
          onSetRating: ops.setRating,
          clickToRate: true,
          withoutContext: true
        }
      ) : null),
      /* @__PURE__ */ R.createElement("span", { className: "scene-toolbar-group" }, /* @__PURE__ */ R.createElement("span", { className: "refract-sp-ext" }, ExternalPlayer ? /* @__PURE__ */ R.createElement(ExternalPlayer, { scene }) : null), /* @__PURE__ */ R.createElement("span", null, /* @__PURE__ */ R.createElement(
        CountButton,
        {
          value: scene.play_count || 0,
          title: "Play Count",
          icon: faEye,
          onIncrement: ops.incrementPlay
        }
      )), /* @__PURE__ */ R.createElement("span", null, /* @__PURE__ */ R.createElement(
        CountButton,
        {
          value: scene.o_counter || 0,
          title: "O Count",
          icon: sfwContentMode ? faThumbsUp : void 0,
          sweatDrops: !sfwContentMode,
          dataAction: "o-counter",
          onIncrement: ops.incrementO
        }
      )), /* @__PURE__ */ R.createElement("span", null, /* @__PURE__ */ R.createElement(
        OrganizedButton,
        {
          organized: !!scene.organized,
          loading: ops.organizedLoading,
          onClick: ops.toggleOrganized
        }
      )), /* @__PURE__ */ R.createElement("span", null, /* @__PURE__ */ R.createElement(OperationsMenu, { scene, ops, onHandOver })))
    );
  };
  const TierChip = ({ rating100, starsMode, open, onToggle }) => {
    const rated = typeof rating100 === "number" && rating100 > 0;
    const tier = rated ? tierFor(rating100) : void 0;
    const label = rated ? tier || "Rated" : "Unrated";
    const value = rated ? ratingDisplay(rating100, starsMode) : "";
    const outOf = starsMode ? " of 5" : " of 10";
    const title = rated ? "Rated " + value + outOf + (tier ? ", " + tier : "") + ". Click to change." : "Not rated. Click to rate.";
    return /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "st-tier-chip",
        "aria-expanded": open,
        "data-tier": tier || "",
        "data-rated": rated ? "1" : "0",
        title,
        onClick: onToggle
      },
      /* @__PURE__ */ R.createElement("span", { className: "st-tier-name" }, label),
      /* @__PURE__ */ R.createElement("span", { className: "st-tier-value", hidden: !value }, value)
    );
  };
  const CountButton = ({ value, title, icon: icon2, sweatDrops, dataAction, onIncrement }) => {
    const Icon = stashComponent("Icon");
    const SweatDrops = stashComponent("SweatDrops");
    const glyph = sweatDrops && SweatDrops ? /* @__PURE__ */ R.createElement(SweatDrops, null) : Icon && icon2 ? /* @__PURE__ */ R.createElement(Icon, { icon: icon2 }) : null;
    return /* @__PURE__ */ R.createElement("div", { className: "btn-group count-button increment-only", "data-action": dataAction }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-secondary minimal count-icon",
        onClick: onIncrement,
        title
      },
      glyph
    ), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-secondary minimal count-value",
        onClick: onIncrement
      },
      /* @__PURE__ */ R.createElement("span", null, value)
    ));
  };
  const OrganizedButton = ({ organized, loading, onClick }) => {
    const Icon = stashComponent("Icon");
    if (loading) {
      return /* @__PURE__ */ R.createElement(
        "span",
        {
          className: "spinner-border spinner-border-sm",
          role: "status",
          "aria-label": "Saving"
        }
      );
    }
    return /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        title: "Organized",
        "aria-pressed": organized,
        className: "btn btn-secondary minimal organized-button " + (organized ? "organized" : "not-organized"),
        onClick
      },
      Icon && faBox ? /* @__PURE__ */ R.createElement(Icon, { icon: faBox }) : null
    );
  };
  const OperationsMenu = ({ ops, onHandOver }) => {
    const Icon = stashComponent("Icon");
    const [open, setOpen] = useState(false);
    const canMerge = !!stashComponent("SceneMergeModal");
    useEffect(() => {
      if (!open) return void 0;
      const onKey = (e) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [open]);
    useEffect(() => {
      const onPress = (e) => {
        const body = document.body;
        if (!body || !body.classList.contains(OWNED_BODY_CLASS)) return;
        if (!document.querySelector(THEME_TRANSIENT_CHROME)) return;
        const t = e.target;
        if (t && t.closest) {
          if (t.closest(THEME_OP_MENU_ITEM)) return;
          if (t.closest("#" + OPERATION_MENU_ID)) return;
        }
        removeThemeChrome(document);
        setOpen(false);
      };
      document.addEventListener("click", onPress, true);
      return () => document.removeEventListener("click", onPress, true);
    }, []);
    const items = useMemo(() => {
      const list = [];
      if (ops.hasFiles) {
        list.push({ key: "rescan", label: "Rescan", run: ops.rescan });
      }
      list.push({ key: "generate", label: "Generate…", run: ops.openGenerate });
      list.push({
        key: "generate-screenshot",
        label: "Generate thumbnail from current",
        run: () => ops.generateScreenshot(getPlayerPosition())
      });
      list.push({
        key: "generate-default",
        label: "Generate default thumbnail",
        run: () => ops.generateScreenshot()
      });
      if (ops.hasStashBoxes) {
        list.push({
          key: "submit",
          label: "Submit to Stash-Box",
          run: ops.openDraft
        });
      }
      list.push({
        key: "merge-scene",
        label: "Merge...",
        run: canMerge ? ops.openMerge : () => onHandOver("merge")
      });
      list.push({ key: "delete-scene", label: "Delete", run: ops.openDelete });
      return list;
    }, [ops, canMerge, onHandOver]);
    return /* @__PURE__ */ R.createElement("div", { className: "dropdown" + (open ? " show" : "") }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        id: OPERATION_MENU_ID,
        className: "btn btn-secondary minimal dropdown-toggle",
        title: "Operations",
        "aria-haspopup": "true",
        "aria-expanded": open,
        onClick: () => setOpen((o) => !o),
        onBlur: () => window.setTimeout(() => setOpen(false), 150)
      },
      Icon && faEllipsisV ? /* @__PURE__ */ R.createElement(Icon, { icon: faEllipsisV }) : null
    ), /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "dropdown-menu bg-secondary text-white" + (open ? " show" : ""),
        "aria-labelledby": OPERATION_MENU_ID
      },
      items.map((it) => /* @__PURE__ */ R.createElement(
        "button",
        {
          type: "button",
          key: it.key,
          className: "dropdown-item bg-secondary text-white",
          onClick: () => {
            setOpen(false);
            it.run();
          }
        },
        it.label
      ))
    ));
  };
  function useSceneOperations(props) {
    const { scene, onDelete } = props;
    const Toast = useToast();
    const { stashBoxes } = useStashConfiguration();
    const [updateScene] = useSceneUpdate();
    const [incrementOMutation] = useSceneIncrementO(scene.id);
    const [incrementPlayMutation] = useSceneIncrementPlayCount();
    const [generateScreenshotMutation] = useSceneGenerateScreenshot();
    const [organizedLoading, setOrganizedLoading] = useState(false);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [draftOpen, setDraftOpen] = useState(false);
    const setRating = useCallback(
      (v) => {
        updateScene({
          variables: { input: { id: scene.id, rating100: v } }
        }).catch((e) => Toast.error(e));
      },
      [updateScene, scene.id, Toast]
    );
    const incrementO = useCallback(() => {
      incrementOMutation().catch((e) => Toast.error(e));
    }, [incrementOMutation, Toast]);
    const incrementPlay = useCallback(() => {
      incrementPlayMutation({ variables: { id: scene.id } }).catch(
        (e) => Toast.error(e)
      );
    }, [incrementPlayMutation, scene.id, Toast]);
    const toggleOrganized = useCallback(() => {
      setOrganizedLoading(true);
      updateScene({ variables: { input: { id: scene.id, organized: !scene.organized } } }).catch((e) => Toast.error(e)).then(() => setOrganizedLoading(false));
    }, [updateScene, scene.id, scene.organized, Toast]);
    const rescan = useCallback(() => {
      metadataScan({ paths: [scenePath(scene)], rescan: true }).then(() => Toast.success("Rescanning scene")).catch((e) => Toast.error(e));
    }, [scene, Toast]);
    const generateScreenshot = useCallback(
      (at) => {
        generateScreenshotMutation({ variables: { id: scene.id, at } }).then(() => Toast.success("Generating screenshot")).catch((e) => Toast.error(e));
      },
      [generateScreenshotMutation, scene.id, Toast]
    );
    const closeMerge = useCallback(
      (mergedID) => {
        setMergeOpen(false);
        if (mergedID !== void 0 && mergedID !== scene.id) {
          try {
            window.location.assign("/scenes/" + mergedID);
          } catch {
          }
        }
      },
      [scene.id]
    );
    const closeDelete = useCallback(
      (deleted) => {
        setDeleteOpen(false);
        if (deleted) onDelete();
      },
      [onDelete]
    );
    return useMemo(
      () => ({
        setRating,
        incrementO,
        incrementPlay,
        toggleOrganized,
        organizedLoading,
        rescan,
        generateScreenshot,
        openGenerate: () => setGenerateOpen(true),
        openMerge: () => setMergeOpen(true),
        openDelete: () => setDeleteOpen(true),
        openDraft: () => setDraftOpen(true),
        hasStashBoxes: stashBoxes.length > 0,
        hasFiles: !!(scene.files && scene.files.length),
        generateOpen,
        mergeOpen,
        deleteOpen,
        draftOpen,
        closeGenerate: () => setGenerateOpen(false),
        closeMerge,
        closeDelete,
        closeDraft: () => setDraftOpen(false)
      }),
      [
        setRating,
        incrementO,
        incrementPlay,
        toggleOrganized,
        organizedLoading,
        rescan,
        generateScreenshot,
        stashBoxes.length,
        scene.files,
        generateOpen,
        mergeOpen,
        deleteOpen,
        draftOpen,
        closeMerge,
        closeDelete
      ]
    );
  }
  const SceneDialogs = ({ ops, scene, title }) => {
    const { stashBoxes } = useStashConfiguration();
    const MergeModal = stashComponent("SceneMergeModal");
    const DeleteDialog = useLoadablePanel("DeleteScenesDialog");
    const GenerateDialogComp = useLoadablePanel("GenerateDialog");
    const SubmitDraft = useLoadablePanel("SubmitStashBoxDraft");
    return /* @__PURE__ */ R.createElement(R.Fragment, null, ops.generateOpen && GenerateDialogComp ? /* @__PURE__ */ R.createElement(
      GenerateDialogComp,
      {
        selectedIds: [scene.id],
        onClose: ops.closeGenerate,
        type: "scene"
      }
    ) : null, MergeModal ? /* @__PURE__ */ R.createElement(
      MergeModal,
      {
        show: ops.mergeOpen,
        onClose: ops.closeMerge,
        scenes: [{ id: scene.id, title }]
      }
    ) : null, ops.deleteOpen && DeleteDialog ? /* @__PURE__ */ R.createElement(DeleteDialog, { selected: [scene], onClose: ops.closeDelete }) : null, SubmitDraft ? /* @__PURE__ */ R.createElement(
      SubmitDraft,
      {
        type: "scene",
        boxes: stashBoxes,
        entity: scene,
        show: ops.draftOpen,
        onHide: ops.closeDraft
      }
    ) : null);
  };
  const STACK = 5;
  const CreditRow = ({ performers, ageFromDate }) => {
    const [open, setOpen] = useState(false);
    const PerformerCard = stashComponent("PerformerCard");
    if (!performers.length) return null;
    const sorted = sortPerformers(performers);
    const shown = sorted.slice(0, STACK);
    const beyond = sorted.length - shown.length;
    return /* @__PURE__ */ R.createElement("section", { className: "refract-sp-credit" + (open ? " is-open" : "") }, /* @__PURE__ */ R.createElement("h2", { className: "refract-sp-label" }, sorted.length === 1 ? "Performer" : "Performers", /* @__PURE__ */ R.createElement("span", { className: "refract-sp-count" }, sorted.length)), open && PerformerCard ? /* @__PURE__ */ R.createElement("div", { className: "refract-sp-cards" }, sorted.map((p) => /* @__PURE__ */ R.createElement(
      PerformerCard,
      {
        key: p.id,
        performer: p,
        ageFromDate: ageFromDate || void 0
      }
    ))) : /* @__PURE__ */ R.createElement("div", { className: "refract-sp-faces" }, shown.map((p, i) => /* @__PURE__ */ R.createElement(
      AppLink,
      {
        key: p.id,
        to: "/performers/" + p.id,
        className: "refract-sp-face",
        title: p.name
      },
      p.image_path ? /* @__PURE__ */ R.createElement(
        "img",
        {
          src: p.image_path,
          alt: "",
          loading: i === 0 ? void 0 : "lazy"
        }
      ) : /* @__PURE__ */ R.createElement("span", { className: "refract-sp-face-initial", "aria-hidden": "true" }, p.name.slice(0, 1))
    )), beyond > 0 ? /* @__PURE__ */ R.createElement("span", { className: "refract-sp-face-more" }, "+", beyond) : null), /* @__PURE__ */ R.createElement("div", { className: "refract-sp-credit-foot" }, /* @__PURE__ */ R.createElement("p", { className: "refract-sp-names" }, sorted.map((p, i) => /* @__PURE__ */ R.createElement(R.Fragment, { key: p.id }, i > 0 ? ", " : null, /* @__PURE__ */ R.createElement(AppLink, { to: "/performers/" + p.id }, p.name)))), PerformerCard ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-sp-more",
        "aria-expanded": open,
        onClick: () => setOpen((o) => !o)
      },
      open ? LESS_LABEL : MORE_LABEL,
      /* @__PURE__ */ R.createElement("span", { className: "refract-sp-hook" }, " of the performers")
    ) : null));
  };
  const GENDER_ORDER = [
    "FEMALE",
    "TRANSGENDER_FEMALE",
    "MALE",
    "TRANSGENDER_MALE",
    "INTERSEX",
    "NON_BINARY"
  ];
  function sortPerformers(performers) {
    return performers.slice().sort((a, b) => {
      if (a.gender === b.gender) return (a.name || "").localeCompare(b.name || "");
      const ai = a.gender ? GENDER_ORDER.indexOf(a.gender) : GENDER_ORDER.length;
      const bi = b.gender ? GENDER_ORDER.indexOf(b.gender) : GENDER_ORDER.length;
      return (ai < 0 ? GENDER_ORDER.length : ai) - (bi < 0 ? GENDER_ORDER.length : bi);
    });
  }
  const apollo = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Apollo;
  })();
  const EMPTY = {};
  function useTagCounts(ids) {
    const key = ids.join(",");
    const doc = useMemo(() => {
      if (!apollo || !apollo.gql || !ids.length) return void 0;
      const body = ids.map((id) => "t" + id + ": findTag(id: " + JSON.stringify(id) + ") { scene_count }").join("\n");
      try {
        return apollo.gql(["query RefractSceneTagCounts {\n" + body + "\n}"]);
      } catch (e) {
        warnOnce("could not build the tag count query", e);
        return void 0;
      }
    }, [key]);
    const useQuery = apollo && apollo.useQuery;
    const result = useQuery ? useQuery(doc || FALLBACK_DOC, { skip: !doc, fetchPolicy: "cache-first" }) : void 0;
    return useMemo(() => {
      const data = result && result.data;
      if (!data) return EMPTY;
      const out = {};
      for (const id of ids) {
        const row = data["t" + id];
        if (row && typeof row.scene_count === "number") out[id] = row.scene_count;
      }
      return out;
    }, [result && result.data, key]);
  }
  const FALLBACK_DOC = (() => {
    if (!apollo || !apollo.gql) return void 0;
    try {
      return apollo.gql(["query RefractSceneTagCountsNone { version { version } }"]);
    } catch {
      return void 0;
    }
  })();
  const LEAD_FALLBACK = 8;
  const MIN_ROWS = 2;
  const TAIL_RESERVE = 32;
  const UNMEASURABLE_RETRIES = 40;
  const STACK_QUERY = "(max-width: 1199.98px)";
  const CRITERION_RE = /^\s*(?:\[|\()?\s*(?:adv|rating|crit)[\s:_-]/i;
  const TagRow = ({ tags }) => {
    const TagLink = stashComponent("TagLink");
    const subject = useMemo(
      () => tags.filter((t) => !CRITERION_RE.test(t.name)),
      [tags]
    );
    const ids = useMemo(() => subject.map((t) => t.id), [subject]);
    const counts = useTagCounts(ids);
    const sorted = useMemo(() => {
      const known = (t) => typeof counts[t.id] === "number" ? counts[t.id] : Number.MAX_SAFE_INTEGER;
      return subject.slice().sort((a, b) => {
        const d = known(a) - known(b);
        if (d !== 0) return d;
        return a.name.localeCompare(b.name);
      });
    }, [subject, counts]);
    const [leadCount, setLeadCount] = useState(null);
    const [askToken, setAskToken] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const rowRef = useRef(null);
    const measuredFor = useRef("");
    const geometryFor = useRef("");
    const observerRef = useRef(null);
    const childrenRef = useRef(null);
    const observedRef = useRef([]);
    const retriesRef = useRef(0);
    const rafRef = useRef(0);
    const observerRafRef = useRef(0);
    const aliveRef = useRef(true);
    const signature = useMemo(() => sorted.map((t) => t.id).join(","), [sorted]);
    useEffect(() => {
      if (measuredFor.current !== signature) setLeadCount(null);
    }, [signature]);
    useEffect(
      () => () => {
        aliveRef.current = false;
        if (observerRef.current) observerRef.current.disconnect();
        if (childrenRef.current) childrenRef.current.disconnect();
        if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
        if (observerRafRef.current) {
          window.cancelAnimationFrame(observerRafRef.current);
        }
      },
      []
    );
    const reask = useCallback(() => {
      measuredFor.current = "";
      geometryFor.current = "";
      setLeadCount(null);
      setAskToken((t) => t + 1);
    }, []);
    const reaskFresh = useCallback(() => {
      retriesRef.current = 0;
      reask();
    }, [reask]);
    useEffect(() => {
      if (typeof window.matchMedia !== "function") return void 0;
      const mq = window.matchMedia(STACK_QUERY);
      const onChange = () => reaskFresh();
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
      }
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }, [reaskFresh]);
    useLayoutEffect(() => {
      if (leadCount !== null) return;
      const row = rowRef.current;
      if (!row) return;
      const chips = Array.prototype.slice.call(
        row.children
      );
      if (!chips.length) {
        measuredFor.current = signature;
        setLeadCount(0);
        return;
      }
      const budget = budgetOf(row);
      const port = budget.kind === "bounded" ? budget.port : null;
      attachObservers(row, port, paneOf(row), observerRef, childrenRef, observedRef, () => {
        if (observerRafRef.current) return;
        observerRafRef.current = window.requestAnimationFrame(() => {
          observerRafRef.current = 0;
          if (!aliveRef.current) return;
          const now = geometrySignature(row, budgetOf(row));
          if (!now || now === geometryFor.current) return;
          reaskFresh();
        });
      });
      if (budget.kind === "free") {
        measuredFor.current = signature;
        geometryFor.current = FREE_SIGNATURE;
        retriesRef.current = 0;
        setLeadCount(sorted.length);
        return;
      }
      const rowTop = row.getBoundingClientRect().top;
      const portBottom = port ? port.getBoundingClientRect().bottom : 0;
      const available = portBottom - rowTop - reservedBelow(row) - TAIL_RESERVE;
      const first = chips[0].getBoundingClientRect();
      const chipHeight = first.height;
      if (!port || !port.clientHeight || !chipHeight || available <= 0) {
        setLeadCount(Math.min(LEAD_FALLBACK, chips.length));
        if (retriesRef.current < UNMEASURABLE_RETRIES) {
          retriesRef.current += 1;
          rafRef.current = window.requestAnimationFrame(() => {
            rafRef.current = 0;
            reask();
          });
        }
        return;
      }
      retriesRef.current = 0;
      const styles = window.getComputedStyle(row);
      const gap = parseFloat(styles.rowGap || "0") || 0;
      const rows = Math.max(
        MIN_ROWS,
        Math.floor((available + gap) / (chipHeight + gap))
      );
      const tops = [];
      let fit = 0;
      for (const chip of chips) {
        const top = Math.round(chip.getBoundingClientRect().top - rowTop);
        let idx = tops.indexOf(top);
        if (idx < 0) {
          const near = tops.findIndex((t) => Math.abs(t - top) <= 2);
          if (near >= 0) idx = near;
          else {
            tops.push(top);
            idx = tops.length - 1;
          }
        }
        if (idx < rows) fit += 1;
        else break;
      }
      measuredFor.current = signature;
      geometryFor.current = geometrySignature(row, budget) || "";
      setLeadCount(Math.max(1, fit));
    }, [leadCount, askToken, signature, reask]);
    const toggle = useCallback(() => setExpanded((e) => !e), []);
    if (!sorted.length) return null;
    const lead = leadCount === null ? sorted : sorted.slice(0, leadCount);
    const rest = leadCount === null ? [] : sorted.slice(leadCount);
    return /* @__PURE__ */ R.createElement("section", { className: "refract-sp-tags" }, /* @__PURE__ */ R.createElement("h2", { className: "refract-sp-label" }, sorted.length === 1 ? "Tag" : "Tags", /* @__PURE__ */ R.createElement("span", { className: "refract-sp-count" }, sorted.length)), /* @__PURE__ */ R.createElement("div", { className: "refract-sp-tag-row", ref: rowRef }, lead.map((tag) => /* @__PURE__ */ R.createElement("span", { className: "refract-sp-tag", key: tag.id }, TagLink ? /* @__PURE__ */ R.createElement(TagLink, { tag, linkType: "scene" }) : tag.name, typeof counts[tag.id] === "number" ? /* @__PURE__ */ R.createElement("span", { className: "refract-sp-tag-n" }, formatCount(counts[tag.id])) : null))), rest.length ? /* @__PURE__ */ R.createElement(R.Fragment, null, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-sp-more",
        "aria-expanded": expanded,
        onClick: toggle
      },
      expanded ? LESS_LABEL : rest.length + " " + MORE_LABEL.toLowerCase(),
      /* @__PURE__ */ R.createElement("span", { className: "refract-sp-hook" }, expanded ? " of the tag list" : rest.length === 1 ? " tag" : " tags")
    ), expanded ? /* @__PURE__ */ R.createElement("p", { className: "refract-sp-tag-run" }, rest.map((tag, i) => /* @__PURE__ */ R.createElement(R.Fragment, { key: tag.id }, i > 0 ? ", " : null, TagLink ? /* @__PURE__ */ R.createElement(TagLink, { tag, linkType: "scene" }) : tag.name))) : null) : null);
  };
  function reservedBelow(row) {
    const section = row.parentElement;
    const column = section && section.parentElement;
    if (!section || !column) return 0;
    const gap = parseFloat(window.getComputedStyle(column).rowGap || "0") || 0;
    let total = 0;
    let node = section.nextElementSibling;
    while (node) {
      total += node.offsetHeight + gap;
      node = node.nextElementSibling;
    }
    return total;
  }
  function geometrySignature(row, budget) {
    if (budget.kind === "free") return FREE_SIGNATURE;
    if (budget.kind !== "bounded") return "";
    const port = budget.port;
    if (!port.clientHeight) return "";
    const rowTop = Math.round(
      row.getBoundingClientRect().top - port.getBoundingClientRect().top
    );
    return port.clientWidth + "x" + port.clientHeight + "@" + rowTop + "+" + Math.round(reservedBelow(row));
  }
  function attachObservers(row, port, pane, observerRef, childrenRef, observedRef, onChange) {
    const section = row.parentElement;
    const column = section && section.parentElement;
    if (column && !childrenRef.current && typeof MutationObserver !== "undefined") {
      const mo = new MutationObserver(onChange);
      mo.observe(column, { childList: true });
      childrenRef.current = mo;
    }
    if (typeof ResizeObserver === "undefined") return;
    const want = [];
    if (port) want.push(port);
    if (pane && pane !== port) want.push(pane);
    if (column) {
      for (const child of Array.prototype.slice.call(
        column.children
      )) {
        if (child !== section) want.push(child);
      }
    }
    if (!want.length) return;
    const same = observedRef.current.length === want.length && want.every((el, i) => observedRef.current[i] === el);
    if (same && observerRef.current) return;
    if (observerRef.current) observerRef.current.disconnect();
    const ro = new ResizeObserver(onChange);
    for (const el of want) ro.observe(el);
    observerRef.current = ro;
    observedRef.current = want;
  }
  const FREE_SIGNATURE = "free";
  function budgetOf(row) {
    const port = scrollPortOf$1(row);
    if (port) return { kind: "bounded", port };
    const pane = paneOf(row);
    if (!pane) return { kind: "unknown" };
    const oy = window.getComputedStyle(pane).overflowY;
    if (oy !== "auto" && oy !== "scroll") return { kind: "free" };
    return { kind: "unknown" };
  }
  function paneOf(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains("tab-content")) return node;
      node = node.parentElement;
    }
    return null;
  }
  function scrollPortOf$1(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      if ((oy === "auto" || oy === "scroll") && node.clientHeight > 0) return node;
      node = node.parentElement;
    }
    return null;
  }
  const LOOSE_SLACK = 48;
  const DetailsPanel = ({ scene, onEdit }) => {
    const CustomFields = stashComponent("CustomFields");
    const customFields = scene.custom_fields;
    const hasCustomFields = !!(customFields && Object.keys(customFields).length > 0);
    const columnRef = useRef(null);
    const loose = usePinSlack(columnRef);
    const bare = !scene.details && !scene.tags.length && !scene.performers.length && !hasCustomFields;
    return /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "refract-sp-details" + (loose ? " is-loose" : ""),
        ref: columnRef
      },
      bare ? /* @__PURE__ */ R.createElement("section", { className: "refract-sp-invite" }, /* @__PURE__ */ R.createElement("p", null, "This scene has no description, tags or performers yet."), /* @__PURE__ */ R.createElement("button", { type: "button", className: "refract-sp-more", onClick: onEdit }, "Edit")) : null,
      /* @__PURE__ */ R.createElement(Description, { details: scene.details }),
      /* @__PURE__ */ R.createElement(TagRow, { tags: scene.tags }),
      hasCustomFields && CustomFields ? /* @__PURE__ */ R.createElement("div", { className: "refract-sp-custom" }, /* @__PURE__ */ R.createElement(CustomFields, { values: customFields, fullWidth: true })) : null,
      /* @__PURE__ */ R.createElement(MetaStrip, { scene }),
      /* @__PURE__ */ R.createElement("div", { className: "refract-sp-credit-slot" }, /* @__PURE__ */ R.createElement(CreditRow, { performers: scene.performers, ageFromDate: scene.date }))
    );
  };
  function usePinSlack(ref) {
    const [loose, setLoose] = useState(false);
    const rafRef = useRef(0);
    const aliveRef = useRef(true);
    useEffect(() => () => {
      aliveRef.current = false;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    }, []);
    useLayoutEffect(() => {
      const column = ref.current;
      if (!column) return void 0;
      const measure = () => {
        const slot = column.querySelector(
          ".refract-sp-credit-slot"
        );
        const port2 = scrollPortOf(column);
        if (!slot || !port2 || !port2.clientHeight) return;
        const gap = parseFloat(window.getComputedStyle(column).rowGap || "0") || 0;
        const prev = slot.previousElementSibling;
        const above = prev ? prev.getBoundingClientRect().bottom + gap : column.getBoundingClientRect().top;
        const natural = above + slot.offsetHeight;
        const slack = port2.getBoundingClientRect().bottom - natural;
        setLoose(slack > LOOSE_SLACK);
      };
      const later = () => {
        if (rafRef.current) return;
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = 0;
          if (aliveRef.current) measure();
        });
      };
      measure();
      if (typeof ResizeObserver === "undefined") return void 0;
      const port = scrollPortOf(column);
      const ro = new ResizeObserver(later);
      if (port) ro.observe(port);
      ro.observe(column);
      for (const child of Array.prototype.slice.call(
        column.children
      )) {
        ro.observe(child);
      }
      let mo = null;
      if (typeof MutationObserver !== "undefined") {
        mo = new MutationObserver(later);
        mo.observe(column, { childList: true });
      }
      return () => {
        ro.disconnect();
        if (mo) mo.disconnect();
      };
    });
    return loose;
  }
  function scrollPortOf(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const oy = window.getComputedStyle(node).overflowY;
      if ((oy === "auto" || oy === "scroll") && node.clientHeight > 0) return node;
      node = node.parentElement;
    }
    return null;
  }
  const Description = ({ details }) => {
    const [open, setOpen] = useState(false);
    const [clamped, setClamped] = useState(false);
    const ref = useRef(null);
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) {
        setClamped(false);
        return void 0;
      }
      const read = () => setClamped(el.scrollHeight - el.clientHeight > 1);
      read();
      if (typeof ResizeObserver === "undefined") return void 0;
      let pending2 = 0;
      const later = () => {
        if (pending2) return;
        pending2 = window.requestAnimationFrame(() => {
          pending2 = 0;
          read();
        });
      };
      const ro = new ResizeObserver(later);
      ro.observe(el);
      return () => {
        ro.disconnect();
        if (pending2) window.cancelAnimationFrame(pending2);
      };
    }, [details]);
    const toggle = useCallback(() => setOpen((o) => !o), []);
    if (!details) return null;
    return /* @__PURE__ */ R.createElement("section", { className: "refract-sp-description" }, /* @__PURE__ */ R.createElement("p", { className: "refract-sp-desc" + (open ? " is-open" : ""), ref }, details), clamped || open ? /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "refract-sp-more",
        "aria-expanded": open,
        onClick: toggle
      },
      open ? LESS_LABEL : MORE_LABEL,
      /* @__PURE__ */ R.createElement("span", { className: "refract-sp-hook" }, " of the description")
    ) : null);
  };
  const MetaStrip = ({ scene }) => {
    const [shown, setShown] = useState(() => !sceneMetaHidden());
    useEffect(() => {
      const onChange = () => setShown(!sceneMetaHidden());
      const off = onBodyClassChange(onChange);
      document.addEventListener("refract:settings", onChange);
      return () => {
        off();
        document.removeEventListener("refract:settings", onChange);
      };
    }, []);
    const directorUrl = useMemo(() => directorLink(scene.director), [scene.director]);
    if (!shown) return null;
    const rows = [];
    if (scene.created_at) {
      rows.push(
        /* @__PURE__ */ R.createElement(Fact, { key: "created", label: /* @__PURE__ */ R.createElement(Label, { id: "created_at" }), value: formatDateTime(scene.created_at) })
      );
    }
    if (scene.updated_at) {
      rows.push(
        /* @__PURE__ */ R.createElement(Fact, { key: "updated", label: /* @__PURE__ */ R.createElement(Label, { id: "updated_at" }), value: formatDateTime(scene.updated_at) })
      );
    }
    if (scene.code) {
      rows.push(/* @__PURE__ */ R.createElement(Fact, { key: "code", label: /* @__PURE__ */ R.createElement(Label, { id: "scene_code" }), value: scene.code }));
    }
    if (scene.director) {
      rows.push(
        /* @__PURE__ */ R.createElement(
          Fact,
          {
            key: "director",
            label: /* @__PURE__ */ R.createElement(Label, { id: "director" }),
            value: directorUrl ? /* @__PURE__ */ R.createElement(AppLink, { to: directorUrl }, scene.director) : scene.director
          }
        )
      );
    }
    if (!rows.length) return null;
    return /* @__PURE__ */ R.createElement("dl", { className: "refract-sp-record" }, rows);
  };
  const LABEL_FALLBACK = {
    created_at: "Created At",
    updated_at: "Updated At",
    scene_code: "Studio Code",
    director: "Director"
  };
  const Label = ({ id }) => {
    const FormattedMessage = formattedMessage();
    if (!FormattedMessage) return /* @__PURE__ */ R.createElement(R.Fragment, null, LABEL_FALLBACK[id] || id);
    return /* @__PURE__ */ R.createElement(FormattedMessage, { id });
  };
  const Fact = ({ label, value }) => /* @__PURE__ */ R.createElement("div", { className: "refract-sp-fact" }, /* @__PURE__ */ R.createElement("dt", null, label), /* @__PURE__ */ R.createElement("dd", null, value));
  function directorLink(director) {
    if (!director) return void 0;
    const api = pluginApi();
    const nav = api && api.utils && api.utils.NavUtils;
    if (!nav || typeof nav.makeDirectorScenesUrl !== "function") return void 0;
    try {
      return nav.makeDirectorScenesUrl(director);
    } catch {
      return void 0;
    }
  }
  function formatDateTime(value) {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return new Intl.DateTimeFormat(void 0, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(d);
    } catch {
      return value;
    }
  }
  const bootstrap = (() => {
    const api = pluginApi();
    return api && api.libraries && api.libraries.Bootstrap;
  })();
  const SceneTabs = (props) => {
    const {
      scene,
      activeTabKey,
      setActiveTabKey,
      onEdit,
      onClickMarker,
      onLoopMarker,
      queueScenes,
      queueStart,
      queueHasMoreScenes,
      continuePlaylist,
      setContinuePlaylist,
      onQueueSceneClicked,
      onQueueNext,
      onQueuePrevious,
      onQueueRandom,
      onQueueMoreScenes,
      onQueueLessScenes
    } = props;
    const Tab = bootstrap && bootstrap.Tab;
    const Nav = bootstrap && bootstrap.Nav;
    const TabsContainer = stashComponent("ScenePage.Tabs");
    const TabContentContainer = stashComponent("ScenePage.TabContent");
    const QueueViewer = useLoadablePanel("QueueViewer");
    const MarkersPanel = useLoadablePanel("SceneMarkersPanel");
    const GroupPanel = useLoadablePanel("SceneGroupPanel");
    const GalleriesPanel = useLoadablePanel(
      "SceneGalleriesPanel"
    );
    const GalleryViewerPanel = useLoadablePanel("GalleryViewer");
    const VideoFilterPanel = useLoadablePanel(
      "SceneVideoFilterPanel"
    );
    const HistoryPanel = useLoadablePanel("SceneHistoryPanel");
    const FileInfoPanel = stashComponent("SceneFileInfoPanel");
    if (!Tab || !Tab.Container || !Tab.Content || !Tab.Pane || !Nav || !Nav.Item || !Nav.Link) {
      return null;
    }
    const NavItem = Nav.Item;
    const NavLink = Nav.Link;
    const TabPane = Tab.Pane;
    const hasQueue = queueScenes.length > 0;
    const hasGroups = scene.groups.length > 0;
    const hasGalleries = scene.galleries.length >= 1;
    const fileCount = scene.files ? scene.files.length : 0;
    const select = (k) => {
      if (!k) return;
      if (k === TAB_EDIT) {
        onEdit();
        return;
      }
      setActiveTabKey(k);
    };
    const tabs = /* @__PURE__ */ R.createElement(R.Fragment, null, /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_DETAILS }, "Details")), hasQueue ? /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_QUEUE }, "Queue")) : null, /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_MARKERS }, "Markers")), hasGroups ? /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_GROUP }, scene.groups.length === 1 ? "Group" : "Groups")) : null, hasGalleries ? /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_GALLERIES }, scene.galleries.length === 1 ? "Gallery" : "Galleries")) : null, /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_FILTER }, "Filters")), /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_FILE_INFO }, "File Info", /* @__PURE__ */ R.createElement(CountBadge, { count: fileCount }))), /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_HISTORY }, "History")), /* @__PURE__ */ R.createElement(NavItem, null, /* @__PURE__ */ R.createElement(NavLink, { eventKey: TAB_EDIT, onClick: onEdit }, "Edit")));
    const panes = /* @__PURE__ */ R.createElement(R.Fragment, null, /* @__PURE__ */ R.createElement(TabPane, { eventKey: TAB_DETAILS }, /* @__PURE__ */ R.createElement(DetailsPanel, { scene, onEdit })), hasQueue && QueueViewer ? /* @__PURE__ */ R.createElement(TabPane, { eventKey: TAB_QUEUE }, /* @__PURE__ */ R.createElement(
      QueueViewer,
      {
        scenes: queueScenes,
        currentID: scene.id,
        continue: continuePlaylist,
        setContinue: setContinuePlaylist,
        onSceneClicked: onQueueSceneClicked,
        onNext: onQueueNext,
        onPrevious: onQueuePrevious,
        onRandom: onQueueRandom,
        start: queueStart,
        hasMoreScenes: queueHasMoreScenes,
        onLessScenes: onQueueLessScenes,
        onMoreScenes: onQueueMoreScenes
      }
    )) : null, MarkersPanel ? /* @__PURE__ */ R.createElement(TabPane, { eventKey: TAB_MARKERS }, /* @__PURE__ */ R.createElement(
      MarkersPanel,
      {
        sceneId: scene.id,
        onClickMarker,
        onLoopMarker,
        isVisible: activeTabKey === TAB_MARKERS
      }
    )) : null, hasGroups && GroupPanel ? /* @__PURE__ */ R.createElement(TabPane, { eventKey: TAB_GROUP }, /* @__PURE__ */ R.createElement(GroupPanel, { scene })) : null, hasGalleries && GalleriesPanel ? /* @__PURE__ */ R.createElement(TabPane, { eventKey: TAB_GALLERIES }, /* @__PURE__ */ R.createElement(GalleriesPanel, { galleries: scene.galleries }), scene.galleries.length === 1 && GalleryViewerPanel ? /* @__PURE__ */ R.createElement(GalleryViewerPanel, { galleryId: scene.galleries[0].id }) : null) : null, VideoFilterPanel ? /* @__PURE__ */ R.createElement(TabPane, { eventKey: TAB_FILTER }, /* @__PURE__ */ R.createElement(VideoFilterPanel, { scene })) : null, FileInfoPanel ? /* @__PURE__ */ R.createElement(TabPane, { className: "file-info-panel", eventKey: TAB_FILE_INFO }, /* @__PURE__ */ R.createElement(FileInfoPanel, { scene })) : null, HistoryPanel ? /* @__PURE__ */ R.createElement(TabPane, { eventKey: TAB_HISTORY }, /* @__PURE__ */ R.createElement(HistoryPanel, { scene })) : null);
    return /* @__PURE__ */ R.createElement(Tab.Container, { activeKey: activeTabKey, onSelect: select }, /* @__PURE__ */ R.createElement("div", null, /* @__PURE__ */ R.createElement(Nav, { variant: "tabs", className: "mr-auto" }, TabsContainer ? /* @__PURE__ */ R.createElement(TabsContainer, { ...props }, tabs) : tabs)), /* @__PURE__ */ R.createElement(Tab.Content, null, TabContentContainer ? /* @__PURE__ */ R.createElement(TabContentContainer, { ...props }, panes) : panes));
  };
  const CountBadge = ({ count }) => {
    if (count === 0 || count === 1) return null;
    return /* @__PURE__ */ R.createElement(
      "span",
      {
        className: "badge badge-pill badge-secondary left-spacing",
        "data-value": count
      },
      count
    );
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
  const EDIT_SELECTOR = ".modal.show, .scene-tabs .tab-pane.active form, .scene-tabs .tab-pane.active > .LoadingIndicator";
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
  const REQUIRED_COMPONENTS = [
    "ScenePage.Tabs",
    "ScenePage.TabContent",
    "RatingSystem",
    "Icon",
    "SweatDrops"
  ];
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
  const STAGE_STANDBY_CLASS = "refract-sp-stage";
  function sweepTransientChrome(stage) {
    removeThemeChrome(stage);
  }
  function useStandbyStage(attached, mounted, className) {
    const host2 = useRef(null);
    const stage = useRef(null);
    if (!stage.current && typeof document !== "undefined") {
      stage.current = document.createElement("div");
      stage.current.className = STAGE_STANDBY_CLASS;
      stage.current.style.display = "none";
    }
    useLayoutEffect(() => {
      const el = stage.current;
      if (!el) return void 0;
      if (attached && mounted) {
        const anchor = host2.current;
        const parent = anchor && anchor.parentNode;
        if (parent && el.parentNode !== parent) parent.insertBefore(el, anchor);
      } else if (el.parentNode) {
        sweepTransientChrome(el);
        el.parentNode.removeChild(el);
      }
      return () => {
        if (el.parentNode) {
          sweepTransientChrome(el);
          el.parentNode.removeChild(el);
        }
      };
    }, [attached, mounted]);
    useLayoutEffect(() => {
      const el = stage.current;
      if (!el) return;
      if (attached) {
        el.className = className;
        el.style.removeProperty("display");
      } else {
        el.className = STAGE_STANDBY_CLASS;
        el.style.display = "none";
      }
    }, [attached, className]);
    return [stage.current, host2];
  }
  const HOST_STYLE = { display: "contents" };
  function stashActiveTabKey() {
    try {
      const link = document.querySelector(
        ".scene-tabs .nav-link.active[data-rb-event-key]"
      );
      const key = link && link.getAttribute("data-rb-event-key");
      if (!key || key === TAB_EDIT) return void 0;
      return key;
    } catch {
      return void 0;
    }
  }
  const SceneRoute = (props) => {
    const { next: Next, scene, ...rest } = props;
    const { collapsed, setCollapsed } = rest;
    const [mode, setMode] = useState("view");
    const [intent, setIntent] = useState(void 0);
    const [handedBack, setHandedBack] = useState(false);
    const [activeTabKey, setActiveTabKey] = useState(TAB_DETAILS);
    const doorRef = useRef("view");
    useEffect(() => {
      doorRef.current = mode;
    }, [mode]);
    const enabled = ownScenePageEnabled();
    const capable = useCapability();
    const mounted = enabled && capable && !handedBack;
    const owning = mounted && mode === "view";
    const stageClass = "scene-tabs refract-sp order-xl-first order-last" + (collapsed ? " collapsed" : "");
    const [stage, host2] = useStandbyStage(owning, mounted, stageClass);
    useEffect(() => {
      setMode("view");
    }, [scene.id]);
    useEffect(() => {
      if (!owning) return void 0;
      announceOnce("owns the scene panel on /scenes/" + scene.id);
      setBodyClass(true);
      return () => setBodyClass(false);
    }, [owning, scene.id]);
    useEffect(() => {
      if (mode !== "edit") return;
      const mt = mousetrap();
      if (!mt) return;
      try {
        mt.trigger("e");
      } catch {
      }
    }, [mode]);
    useEffect(() => {
      if (mode !== "stash" || intent !== "merge") return void 0;
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        if (tries > 60) {
          window.clearInterval(t);
          warnOnce("handed the page back for Merge but never found Stash's menu");
          setIntent(void 0);
          return;
        }
        const toggle = document.querySelector(
          "#operation-menu"
        );
        if (!toggle) return;
        if (toggle.getAttribute("aria-expanded") !== "true") {
          toggle.click();
          return;
        }
        const menu = toggle.parentElement;
        const overlay = document.querySelector(".st-op-menu-overlay");
        const items = overlay ? Array.prototype.slice.call(
          overlay.querySelectorAll(".st-op-menu-item")
        ) : menu ? Array.prototype.slice.call(
          menu.querySelectorAll(".dropdown-item")
        ) : [];
        if (items.length < 2) return;
        const item = items[items.length - 2];
        window.clearInterval(t);
        setIntent(void 0);
        if (!item) {
          warnOnce("Stash's operations menu carried no Merge item");
          return;
        }
        if (!/^merge/i.test((item.textContent || "").trim())) {
          warnOnce(
            "Stash's second-from-last menu item does not read Merge: " + (item.textContent || "")
          );
        }
        item.click();
      }, 50);
      return () => window.clearInterval(t);
    }, [mode, intent]);
    const startEdit = useCallback(() => setMode("edit"), []);
    const handOver = useCallback((why) => {
      setIntent(why);
      setMode("stash");
    }, []);
    const handBack = useCallback(() => {
      if (doorRef.current === "edit") {
        const key = stashActiveTabKey();
        if (key) setActiveTabKey(key);
      }
      setIntent(void 0);
      setMode("view");
    }, []);
    const handedOver = mode !== "view";
    useReturnFromEdit(handedOver, handBack);
    useEscapeToReturn(handedOver, handBack);
    const fallback = /* @__PURE__ */ R.createElement(Next, { scene, ...rest });
    return /* @__PURE__ */ R.createElement(R.Fragment, null, owning ? null : fallback, mounted ? /* @__PURE__ */ R.createElement("div", { className: "refract-sp-host", style: HOST_STYLE, ref: host2 }, stage ? createPortal(
      /* @__PURE__ */ R.createElement(
        RefractErrorBoundary,
        {
          fallback: owning ? fallback : null,
          onTrip: () => setHandedBack(true)
        },
        /* @__PURE__ */ R.createElement(
          SceneView,
          {
            scene,
            ...rest,
            owned: owning,
            activeTabKey,
            setActiveTabKey,
            onEdit: startEdit,
            onHandOver: handOver
          }
        )
      ),
      stage
    ) : null) : null, owning ? /* @__PURE__ */ R.createElement("div", { className: "scene-divider d-none d-xl-block" }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-primary",
        title: collapsed ? "Show the panel" : "Hide the panel",
        "aria-expanded": !collapsed,
        onClick: () => setCollapsed(!collapsed)
      },
      /* @__PURE__ */ R.createElement(Chevron, { pointsRight: collapsed })
    )) : null);
  };
  const SceneView = (props) => {
    const {
      scene,
      collapsed,
      setCollapsed,
      setTimestamp,
      onQueueNext,
      onQueuePrevious,
      onQueueRandom,
      owned,
      activeTabKey,
      setActiveTabKey,
      onEdit,
      onHandOver
    } = props;
    const ops = useSceneOperations(props);
    const title = useMemo(() => sceneTitle(scene), [scene]);
    useEffect(() => {
      if (!owned) return void 0;
      const was = document.title;
      if (title) document.title = title;
      return () => {
        document.title = was;
      };
    }, [title, owned]);
    const onClickMarker = useCallback(
      (marker) => {
        const plugin = getAbLoopPlugin();
        const opts = plugin && plugin.getOptions();
        const start = opts && opts.start;
        const end = opts && opts.end;
        const hasRange = !!opts && !!opts.enabled && typeof start === "number" && typeof end === "number" && isFinite(start) && isFinite(end);
        if (plugin && opts && hasRange && (marker.seconds < Math.min(start, end) || marker.seconds > Math.max(start, end))) {
          plugin.setOptions({ ...opts, enabled: false });
        }
        setTimestamp(marker.seconds);
      },
      [setTimestamp]
    );
    const onLoopMarker = useCallback(
      (marker) => {
        if (marker.end_seconds === null || marker.end_seconds === void 0) return;
        setTimestamp(marker.seconds);
        const start = Math.min(marker.seconds, marker.end_seconds);
        const end = Math.max(marker.seconds, marker.end_seconds);
        const plugin = getAbLoopPlugin();
        const opts = plugin && plugin.getOptions();
        if (plugin && opts) {
          plugin.setOptions({ ...opts, start, end, enabled: true });
        }
      },
      [setTimestamp]
    );
    usePageKeybinds(
      {
        a: () => setActiveTabKey(TAB_DETAILS),
        q: () => setActiveTabKey(TAB_QUEUE),
        e: onEdit,
        k: () => setActiveTabKey(TAB_MARKERS),
        i: () => setActiveTabKey(TAB_FILE_INFO),
        h: () => setActiveTabKey(TAB_HISTORY),
        o: () => ops.incrementO(),
        "p n": () => onQueueNext(),
        "p p": () => onQueuePrevious(),
        "p r": () => onQueueRandom(),
        ",": () => setCollapsed(!collapsed),
        "d d": () => ops.openDelete(),
        "c c": () => ops.generateScreenshot(getPlayerPosition()),
        "c d": () => ops.generateScreenshot()
      },
      /* A keybind is global. On standby Stash's own panel is binding
         these same keys for itself a moment later, so the claim is
         released on the way over and taken again on the way back. */
      owned
    );
    useRatingKeybinds(ops.setRating, owned);
    return /* @__PURE__ */ R.createElement(R.Fragment, null, /* @__PURE__ */ R.createElement(SceneDialogs, { ops, scene, title }), /* @__PURE__ */ R.createElement("div", { className: "refract-sp-marquee" }, /* @__PURE__ */ R.createElement(Marquee, { scene, title }), /* @__PURE__ */ R.createElement(ControlStrip, { scene, ops, onHandOver })), owned ? /* @__PURE__ */ R.createElement(
      SceneTabs,
      {
        ...props,
        activeTabKey,
        setActiveTabKey,
        onEdit,
        onClickMarker,
        onLoopMarker
      }
    ) : null);
  };
  const Chevron = ({ pointsRight }) => /* @__PURE__ */ R.createElement(
    "svg",
    {
      className: "fa-fw refract-sp-chevron",
      viewBox: "0 0 320 512",
      width: "1em",
      height: "1em",
      "aria-hidden": "true",
      focusable: "false"
    },
    /* @__PURE__ */ R.createElement(
      "path",
      {
        fill: "currentColor",
        d: pointsRight ? "M285.5 273L91.5 467c-9.4 9.4-24.6 9.4-33.9 0l-22.6-22.6c-9.4-9.4-9.4-24.6 0-33.9L188.5 256 34.9 101.5c-9.4-9.4-9.4-24.6 0-33.9L57.5 45c9.4-9.4 24.6-9.4 33.9 0l194 194c9.4 9.4 9.4 24.6 0 34z" : "M34.5 239L228.5 45c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9L131.5 256l153.6 154.5c9.4 9.4 9.4 24.6 0 33.9L262.5 467c-9.4 9.4-24.6 9.4-33.9 0l-194-194c-9.4-9.4-9.4-24.6 0-34z"
      }
    )
  );
  function register() {
    const api = pluginApi();
    if (!api || !api.patch || typeof api.patch.instead !== "function" || !api.React) {
      window.setTimeout(register, 100);
      return;
    }
    try {
      api.patch.instead("ScenePage", function(...args) {
        const next = args.pop();
        const props = args[0];
        if (!props || !props.scene) {
          return R.createElement(next, props);
        }
        return R.createElement(SceneRoute, { ...props, next });
      });
    } catch (e) {
      warnOnce("could not patch ScenePage", e);
    }
  }
  register();
  warmScenePanels();
  if (!pluginApi()) {
    window.setTimeout(warmScenePanels, 200);
  }
})();
