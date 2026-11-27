var RefractCreate = function(exports) {
  "use strict";
  const host$1 = window;
  const React = host$1.PluginApi && host$1.PluginApi.React;
  if (!React) {
    throw new Error("refract-create: PluginApi.React is not available");
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
  R.useLayoutEffect;
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
    throw new Error("refract-create: PluginApi.ReactDOM is not available");
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
  function stashService() {
    const api = pluginApi();
    return api && api.utils && api.utils.StashService || {};
  }
  function apolloClient() {
    const get = stashService().getClient;
    if (typeof get !== "function") return void 0;
    try {
      return get();
    } catch {
      return void 0;
    }
  }
  function gqlDoc(src) {
    const api = pluginApi();
    const gql = api && api.libraries && api.libraries.Apollo && api.libraries.Apollo.gql;
    return typeof gql === "function" ? gql(src) : void 0;
  }
  function stashDocument(name) {
    const api = pluginApi();
    return api && api.GQL ? api.GQL[name] : void 0;
  }
  const announced = {};
  function announceOnce(what) {
    if (announced[what]) return;
    announced[what] = true;
    try {
      console.info("[refract-create] " + what);
    } catch {
    }
  }
  function warnOnce(what, err) {
    if (announced["warn:" + what]) return;
    announced["warn:" + what] = true;
    try {
      if (err === void 0) console.warn("[refract-create] " + what);
      else console.warn("[refract-create] " + what, err);
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
      warnOnce("owned create page threw, handing back to Stash's page", error);
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
  const OWN_CREATE_PAGE_KEY = "refract.ownCreatePage";
  function ownCreatePageEnabled() {
    try {
      return window.localStorage.getItem(OWN_CREATE_PAGE_KEY) !== "0";
    } catch {
      return true;
    }
  }
  const CREATE_UNAVAILABLE_KEY = "refract.ownCreatePage.unavailable";
  function markCreateUnavailable(stashVersion2) {
    try {
      window.localStorage.setItem(
        CREATE_UNAVAILABLE_KEY,
        JSON.stringify({ stash: stashVersion2 || "unknown", at: (/* @__PURE__ */ new Date()).toISOString() })
      );
    } catch {
    }
  }
  function clearCreateUnavailable() {
    try {
      if (window.localStorage.getItem(CREATE_UNAVAILABLE_KEY) !== null) {
        window.localStorage.removeItem(CREATE_UNAVAILABLE_KEY);
      }
    } catch {
    }
  }
  const GRACE_MS = 4e3;
  const CREATE_PATH$1 = /\/performers\/new\/?$/;
  const HOST_SELECTOR = "#performer-page.new-view > .refract-oc-host";
  let poll = 0;
  let formSeenAt = 0;
  let settled = false;
  function onRoute() {
    try {
      return CREATE_PATH$1.test(window.location.pathname);
    } catch {
      return false;
    }
  }
  function stop() {
    if (poll) window.clearInterval(poll);
    poll = 0;
  }
  async function stashVersion() {
    try {
      const c = apolloClient();
      const q = gqlDoc("query RefractCreateVersion { version { version } }");
      if (!c || !q) return "unknown";
      const r = await c.query({ query: q, fetchPolicy: "cache-first" });
      const v = r && r.data;
      return v && v.version && v.version.version || "unknown";
    } catch {
      return "unknown";
    }
  }
  function tick() {
    if (!onRoute() || !ownCreatePageEnabled()) {
      stop();
      return;
    }
    if (document.querySelector(HOST_SELECTOR)) {
      settled = true;
      stop();
      return;
    }
    if (!document.querySelector("#performer-page.new-view")) {
      formSeenAt = 0;
      return;
    }
    if (!formSeenAt) formSeenAt = Date.now();
    if (Date.now() - formSeenAt < GRACE_MS) return;
    settled = true;
    stop();
    stashVersion().then((v) => {
      markCreateUnavailable(v);
      warnOnce("Stash " + v + " did not hand /performers/new over (no ImageInput on its create form); Stash's own form is left as it is");
    });
  }
  function start() {
    stop();
    formSeenAt = 0;
    settled = false;
    if (!onRoute()) return;
    poll = window.setInterval(() => {
      if (!settled) tick();
    }, 250);
  }
  function watchSideDoor() {
    start();
    const api = pluginApi();
    const ev = api && api.Event;
    if (!ev) {
      window.setTimeout(watchSideDoor, 200);
      return;
    }
    if (typeof ev.addEventListener === "function") {
      try {
        ev.addEventListener("stash:location", () => start());
      } catch {
      }
    }
  }
  function client() {
    const c = apolloClient();
    if (!c) throw new Error("Stash's data client is not available on this page.");
    return c;
  }
  function errorText(e) {
    if (!e) return "unknown error";
    const m = e.message;
    return String(m || e).replace(/^GraphQL error: /, "");
  }
  class ReadError extends Error {
  }
  async function run(query, variables, policy = "network-only") {
    if (!query) throw new ReadError("This Stash does not publish the query this page needs.");
    try {
      const r = await client().query({ query, variables, fetchPolicy: policy });
      return r.data || {};
    } catch (e) {
      throw new ReadError(errorText(e));
    }
  }
  const CONFIG_Q = "query RefractCreateBoxes { configuration { general { stashBoxes { name endpoint } } } }";
  async function loadSources(fresh = false) {
    const [cfg, list] = await Promise.all([
      run(
        gqlDoc(CONFIG_Q),
        {},
        "cache-first"
      ),
      run(stashDocument("ListPerformerScrapersDocument"), {}, fresh ? "network-only" : "cache-first")
    ]);
    const boxesRaw = cfg.configuration && cfg.configuration.general && cfg.configuration.general.stashBoxes || [];
    const boxes = boxesRaw.map((b, index) => ({
      kind: "box",
      endpoint: b.endpoint,
      /* Stash's stashboxDisplayName: the name, or "Stash-Box #n" when the
         author left it blank. */
      name: b.name || "Stash-Box #" + (index + 1),
      index
    }));
    const rows = list.listScrapers || [];
    const scrapers = rows.filter((s) => !!(s.performer && (s.performer.supported_scrapes || []).indexOf("NAME") >= 0)).map((s) => ({ kind: "scraper", id: s.id, name: s.name }));
    const urlPatterns = [];
    for (const s of rows) for (const u of s.performer && s.performer.urls || []) urlPatterns.push(u);
    return { boxes, scrapers, urlPatterns };
  }
  async function reloadScrapers() {
    const c = client();
    const m = stashDocument("ReloadScrapersDocument");
    if (!m || !c.mutate) throw new ReadError("This Stash cannot reload scrapers from here.");
    await c.mutate({ mutation: m });
  }
  async function search(source, query) {
    const doc = stashDocument("ScrapeSinglePerformerDocument");
    const src = source.kind === "box" ? { stash_box_endpoint: source.endpoint } : source.kind === "scraper" ? { scraper_id: source.id } : null;
    if (!src) return [];
    const d = await run(doc, {
      source: src,
      input: { query }
    });
    return (d.scrapeSinglePerformer || []).filter(Boolean);
  }
  function looksLikeLink(text) {
    return /^https?:\/\/\S+$/i.test(text.trim());
  }
  async function scrapeLink(url2) {
    const d = await run(stashDocument("ScrapePerformerUrlDocument"), {
      url: url2.trim()
    });
    return d.scrapePerformerURL ? [d.scrapePerformerURL] : [];
  }
  async function readRecord(source, picked) {
    if (source.kind !== "scraper") return picked;
    const input = {};
    for (const [k, v] of Object.entries(picked)) {
      if (k === "__typename" || k === "images" || k === "tags" || k === "stored_id") continue;
      if (k === "image") continue;
      input[k] = v;
    }
    const d = await run(stashDocument("ScrapeSinglePerformerDocument"), {
      source: { scraper_id: source.id },
      input: { performer_input: input }
    });
    const list = d.scrapeSinglePerformer || [];
    if (!list.length) throw new ReadError(source.name + " returned nothing for this result.");
    return mergeRead(source, picked, list[0]);
  }
  function empty(v) {
    return v === null || v === void 0 || typeof v === "string" && !v.trim() || Array.isArray(v) && !v.length;
  }
  function frontPage(u) {
    try {
      const x = new URL(u);
      return (x.pathname === "" || x.pathname === "/") && !x.search && !x.hash;
    } catch {
      return false;
    }
  }
  function mergeRead(source, picked, read) {
    const out = { ...read };
    const from = picked;
    for (const [k, v] of Object.entries(from)) {
      if (k === "__typename" || k === "urls") continue;
      if (empty(out[k]) && !empty(v)) out[k] = v;
    }
    const keep = (l) => Array.isArray(l) ? l.filter((u) => typeof u === "string" && u.trim() && !frontPage(u)) : [];
    const urls = keep(read.urls);
    out.urls = urls.length ? urls : keep(picked.urls);
    if (empty(out.name)) throw new ReadError(source.name + " could not read this record.");
    return out;
  }
  const DUPES_Q = 'query RefractCreateDupes($f: PerformerFilterType) { findPerformers(performer_filter: $f, filter: { per_page: 6, sort: "scenes_count", direction: DESC }) { count performers { id name disambiguation gender scene_count alias_list image_path } } }';
  async function findDupes(name) {
    const v = name.trim();
    if (!v) return { count: 0, list: [] };
    const d = await run(gqlDoc(DUPES_Q), {
      f: {
        name: { value: v, modifier: "EQUALS" },
        OR: { aliases: { value: v, modifier: "EQUALS" } }
      }
    });
    const r = d.findPerformers;
    return r ? { count: r.count, list: r.performers || [] } : { count: 0, list: [] };
  }
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("The file could not be read."));
      r.readAsDataURL(file);
    });
  }
  function emptyDraft(name = "") {
    return {
      name,
      disambiguation: "",
      alias_list: [],
      gender: "",
      birthdate: "",
      death_date: "",
      country: "",
      ethnicity: "",
      hair_color: "",
      eye_color: "",
      height_cm: "",
      weight: "",
      penis_length: "",
      circumcised: "",
      measurements: "",
      fake_tits: "",
      tattoos: "",
      piercings: "",
      career_start: "",
      career_end: "",
      urls: [],
      details: "",
      tags: [],
      ignore_auto_tag: false,
      stash_ids: [],
      custom_fields: {}
    };
  }
  function sourceKey(s) {
    if (!s) return "";
    if (s.kind === "box") return "box:" + s.endpoint;
    if (s.kind === "scraper") return "scraper:" + s.id;
    return "link";
  }
  const GENDERS = [
    ["FEMALE", "Female"],
    ["MALE", "Male"],
    ["TRANSGENDER_FEMALE", "Transgender female"],
    ["TRANSGENDER_MALE", "Transgender male"],
    ["INTERSEX", "Intersex"],
    ["NON_BINARY", "Non-binary"]
  ];
  const CIRCUMCISED = [
    ["CUT", "Cut"],
    ["UNCUT", "Uncut"]
  ];
  function toEnum(value, table) {
    if (!value) return "";
    const norm = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
    for (const [v, label] of table) {
      if (norm === v) return v;
      if (label.toUpperCase().replace(/[\s-]+/g, "_") === norm) return v;
    }
    return "";
  }
  function enumLabel(value, table) {
    for (const [v, label] of table) if (v === value) return label;
    return value;
  }
  function str(v) {
    return v ? String(v) : "";
  }
  function intString(v) {
    if (!v) return "";
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  }
  function floatString(v) {
    if (!v) return "";
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  }
  function draftFromScraped(rec, source) {
    const d = emptyDraft(str(rec.name));
    d.disambiguation = str(rec.disambiguation);
    d.alias_list = str(rec.aliases).split(",").map((a) => a.trim()).filter(Boolean);
    d.gender = toEnum(rec.gender, GENDERS);
    d.birthdate = str(rec.birthdate);
    d.death_date = str(rec.death_date);
    d.country = str(rec.country);
    d.ethnicity = str(rec.ethnicity);
    d.hair_color = str(rec.hair_color);
    d.eye_color = str(rec.eye_color);
    d.height_cm = intString(rec.height);
    d.weight = intString(rec.weight);
    d.penis_length = floatString(rec.penis_length);
    d.circumcised = toEnum(rec.circumcised, CIRCUMCISED);
    d.measurements = str(rec.measurements);
    d.fake_tits = str(rec.fake_tits);
    d.tattoos = str(rec.tattoos);
    d.piercings = str(rec.piercings);
    d.career_start = str(rec.career_start);
    d.career_end = str(rec.career_end);
    d.urls = (rec.urls || []).filter(Boolean);
    d.details = str(rec.details);
    const unmatched = [];
    for (const t of rec.tags || []) {
      if (t.stored_id) d.tags.push({ id: String(t.stored_id), name: t.name });
      else if (t.name) unmatched.push(t.name);
    }
    if (source && source.kind === "box" && rec.remote_site_id) {
      d.stash_ids = [
        {
          endpoint: source.endpoint,
          stash_id: rec.remote_site_id,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      ];
    }
    return { draft: d, unmatchedTags: unmatched };
  }
  const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
  function validate(d) {
    const p = {};
    if (!d.name.trim()) p.name = "A performer needs a name.";
    for (const k of ["birthdate", "death_date", "career_start", "career_end"]) {
      const v = d[k].trim();
      if (v && !DATE_RE.test(v)) {
        p[k] = "Use a year, a year and month, or a full date: 1996, 1996-03 or 1996-03-14.";
      }
    }
    for (const k of ["height_cm", "weight"]) {
      const v = d[k].trim();
      if (v && !/^\d+$/.test(v)) p[k] = "A whole number.";
    }
    const pl = d.penis_length.trim();
    if (pl && !(parseFloat(pl) > 0)) p.penis_length = "A number above zero.";
    const seen = {};
    for (const u of d.urls) {
      const k = u.trim();
      if (!k) continue;
      if (seen[k]) p.urls = "The same link is listed twice.";
      seen[k] = true;
    }
    return p;
  }
  function toCreateInput(d, image) {
    const input = { name: d.name.trim() };
    const put = (k) => {
      const v = String(d[k] || "").trim();
      if (v) input[k] = v;
    };
    put("disambiguation");
    put("birthdate");
    put("death_date");
    put("country");
    put("ethnicity");
    put("hair_color");
    put("eye_color");
    put("measurements");
    put("fake_tits");
    put("tattoos");
    put("piercings");
    put("career_start");
    put("career_end");
    put("details");
    if (d.gender) input.gender = d.gender;
    if (d.circumcised) input.circumcised = d.circumcised;
    if (d.height_cm.trim()) input.height_cm = parseInt(d.height_cm, 10);
    if (d.weight.trim()) input.weight = parseInt(d.weight, 10);
    if (d.penis_length.trim()) input.penis_length = parseFloat(d.penis_length);
    const aliases = d.alias_list.map((a) => a.trim()).filter(Boolean);
    if (aliases.length) input.alias_list = aliases;
    const urls = d.urls.map((u) => u.trim()).filter(Boolean);
    if (urls.length) input.urls = urls;
    if (d.tags.length) input.tag_ids = d.tags.map((t) => t.id);
    const ids = d.stash_ids.filter((x) => x.endpoint && x.stash_id.trim());
    if (ids.length) {
      input.stash_ids = ids.map((x) => {
        const o = { endpoint: x.endpoint, stash_id: x.stash_id.trim() };
        if (x.updated_at) o.updated_at = x.updated_at;
        return o;
      });
    }
    if (d.ignore_auto_tag) input.ignore_auto_tag = true;
    if (Object.keys(d.custom_fields).length) input.custom_fields = d.custom_fields;
    if (image) input.image = image;
    return input;
  }
  const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  function cardPerformer(d, image, id) {
    return {
      id,
      name: d.name.trim() || "New performer",
      disambiguation: d.disambiguation.trim() || null,
      gender: d.gender || null,
      birthdate: d.birthdate.trim() || null,
      death_date: d.death_date.trim() || null,
      country: d.country.trim() || null,
      /* No image: the page passes Stash's default picture for the name
         and gender (defaultFace.ts). The transparent pixel is the last
         resort only, so the card never shows a broken-image glyph. */
      image_path: image || BLANK_IMAGE,
      favorite: false,
      rating100: null,
      o_counter: 0,
      scene_count: 0,
      image_count: 0,
      gallery_count: 0,
      group_count: 0,
      performer_count: 0,
      tags: d.tags.map((t) => ({ id: t.id, name: t.name })),
      stash_ids: d.stash_ids.map((x) => ({ endpoint: x.endpoint, stash_id: x.stash_id })),
      alias_list: d.alias_list,
      urls: d.urls,
      custom_fields: {}
    };
  }
  function dateYear(v) {
    const t = v.trim();
    return DATE_RE.test(t) ? t.slice(0, 4) : "";
  }
  function statStrip(d) {
    const o = {};
    const h = d.height_cm.trim();
    if (/^\d+$/.test(h) && parseInt(h, 10) > 0) o.height_cm = parseInt(h, 10);
    const w = d.weight.trim();
    if (/^\d+$/.test(w) && parseInt(w, 10) > 0) o.weight = parseInt(w, 10);
    const m = d.measurements.trim();
    if (m) o.measurements = m;
    const s = dateYear(d.career_start);
    const e = dateYear(d.career_end);
    if (s || e) o.career_length = s && e ? s + " - " + e : s ? s + " -" : "- " + e;
    return Object.keys(o).length ? JSON.stringify(o) : "";
  }
  function birthYear(date) {
    const m = /^(\d{4})/.exec(date || "");
    return m ? m[1] : "";
  }
  let displayNames;
  function countryName(code) {
    if (!code) return "";
    if (!/^[A-Za-z]{2}$/.test(code)) return code;
    if (displayNames === void 0) {
      try {
        const DN = Intl.DisplayNames;
        displayNames = DN ? new DN([navigator.language || "en"], { type: "region" }) : null;
      } catch {
        displayNames = null;
      }
    }
    try {
      return displayNames && displayNames.of(code.toUpperCase()) || code;
    } catch {
      return code;
    }
  }
  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }
  const LiveCard = ({ performer, width, cardKey, strip, fit }) => {
    const ref = useRef(null);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      el.setAttribute("inert", "");
    }, []);
    const PerformerCard = stashComponent("PerformerCard");
    return /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "roc-card",
        ref,
        "aria-hidden": "true",
        style: { width },
        "data-refract-draft-stats": strip,
        "data-refract-draft-fit": fit
      },
      PerformerCard ? /* @__PURE__ */ R.createElement(PerformerCard, { key: cardKey, performer, cardWidth: width }) : /* @__PURE__ */ R.createElement("div", { className: "roc-card-fallback" }, String(performer.name || ""))
    );
  };
  function pronoun(gender) {
    if (gender === "FEMALE" || gender === "TRANSGENDER_FEMALE") return "her";
    if (gender === "MALE" || gender === "TRANSGENDER_MALE") return "his";
    return "their";
  }
  function sameName(a, b) {
    return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  }
  const LibraryPlate = ({ name, disambiguation, list, count, onDifferent, open }) => {
    if (!list.length) return null;
    const exact = list.find((p) => sameName(p.name, name));
    const first = exact || list[0];
    const scenes = first.scene_count || 0;
    const more = count - 1;
    const label = first.name + (first.disambiguation ? " (" + first.disambiguation + ")" : "");
    const clash = !!exact && sameName(exact.disambiguation || "", disambiguation || "");
    const openLink = /* @__PURE__ */ R.createElement(
      "a",
      {
        className: "roc-link",
        href: "/performers/" + first.id,
        onClick: (e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          open(first.id);
        }
      },
      "Open ",
      pronoun(first.gender),
      " page"
    );
    return /* @__PURE__ */ R.createElement("div", { className: "roc-plate is-library" + (clash ? " is-clash" : ""), role: "status" }, /* @__PURE__ */ R.createElement("p", { className: "roc-plate-line" }, exact ? /* @__PURE__ */ R.createElement(R.Fragment, null, clash ? label + " is already in your library" : "There is another " + label + " in your library", ", " + scenes + (scenes === 1 ? " scene." : " scenes.")) : /* @__PURE__ */ R.createElement(R.Fragment, null, name.trim(), " is an alias of ", label, " in your library, ", scenes, scenes === 1 ? " scene." : " scenes.")), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-actions" }, openLink, clash && onDifferent ? /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-link", onClick: onDifferent }, "This is a different ", first.name) : null, more > 0 ? /* @__PURE__ */ R.createElement("span", { className: "roc-quiet" }, more, " more with this name") : null), clash ? /* @__PURE__ */ R.createElement("p", { className: "roc-plate-note" }, "Stash saves a second performer with the same name only when it has a disambiguation.") : !exact ? /* @__PURE__ */ R.createElement("p", { className: "roc-plate-note" }, "Matched by alias. A different name saves as it is.") : null);
  };
  const Chevron = () => /* @__PURE__ */ R.createElement("svg", { className: "roc-chev", viewBox: "0 0 12 12", width: "12", height: "12", "aria-hidden": "true" }, /* @__PURE__ */ R.createElement("path", { d: "M2.5 4.5 6 8l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }));
  const PlusGlyph = () => /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": "true" }, /* @__PURE__ */ R.createElement("path", { d: "M8 3v10M3 8h10", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }));
  const CrossGlyph = () => /* @__PURE__ */ R.createElement("svg", { viewBox: "0 0 16 16", width: "14", height: "14", "aria-hidden": "true" }, /* @__PURE__ */ R.createElement("path", { d: "M4 4l8 8M12 4l-8 8", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }));
  function sampleColour(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = 12;
          c.height = 12;
          const x = c.getContext("2d");
          if (!x) return resolve(null);
          x.drawImage(img, 0, 0, 12, 12);
          const d = x.getImageData(0, 0, 12, 12).data;
          let r = 0;
          let g = 0;
          let b = 0;
          const n = d.length / 4;
          for (let i = 0; i < d.length; i += 4) {
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
          }
          resolve(capped(r / n, g / n, b / n));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  function capped(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    let l = (max + min) / 2;
    if (max !== min) {
      const dd = max - min;
      s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
      if (max === r) h = (g - b) / dd + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / dd + 2;
      else h = (r - g) / dd + 4;
      h /= 6;
    }
    s = Math.min(s, 0.6);
    l = Math.min(Math.max(l, 0.35), 0.5);
    const hue = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let R2 = l;
    let G = l;
    let B = l;
    if (s) {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      R2 = hue(p, q, h + 1 / 3);
      G = hue(p, q, h);
      B = hue(p, q, h - 1 / 3);
    }
    return Math.round(R2 * 255) + "," + Math.round(G * 255) + "," + Math.round(B * 255);
  }
  const Ambient = ({ src }) => {
    const [layers, setLayers] = R.useState([null, null]);
    const [top, setTop] = R.useState(0);
    const topRef = useRef(0);
    topRef.current = top;
    useEffect(() => {
      let live = true;
      if (!src) return void 0;
      sampleColour(src).then((c) => {
        if (!live || !c) return;
        const next = 1 - topRef.current;
        setLayers((l) => {
          const n = [l[0], l[1]];
          n[next] = c;
          return n;
        });
        setTop(next);
      });
      return () => {
        live = false;
      };
    }, [src]);
    return /* @__PURE__ */ R.createElement("div", { className: "roc-ambient", "aria-hidden": "true" }, layers.map((c, i) => /* @__PURE__ */ R.createElement(
      "i",
      {
        key: i,
        className: i === top && c ? "is-on" : "",
        "data-colour": c || "",
        style: c ? { ["--roc-amb"]: c } : void 0
      }
    )));
  };
  function sourceLabel(s) {
    return s ? s.name : "";
  }
  function statusLine(p) {
    const { search: search2, query, source } = p;
    const src = search2.status !== "idle" && search2.source ? search2.source : source;
    const typed = query.trim();
    if (!typed) return "";
    if (search2.status === "loading") return "Searching " + (src ? src.name : "");
    if (search2.status === "idle" || search2.q !== typed) {
      if (/^https?:\/\/\S+$/i.test(typed)) return "Press Enter to read the link";
      return source ? "Press Enter to search " + sourceLabel(source) : "";
    }
    if (search2.status === "done") {
      if (src && src.kind === "link") return search2.results.length ? "Read from the link" : "";
      return search2.results.length ? plural(search2.results.length, "result", "results") + " on " + sourceLabel(src) : "";
    }
    return "";
  }
  const SourceMenu = ({ source, boxes, scrapers, choose, reload, reloading }) => {
    const [open, setOpen] = useState(false);
    const wrap = useRef(null);
    const btn = useRef(null);
    useEffect(() => {
      if (!open) return void 0;
      const onDown = (e) => {
        if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
      };
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          if (btn.current) btn.current.focus();
        }
      };
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
      const first = wrap.current && wrap.current.querySelector(".roc-menu [aria-checked='true'], .roc-menu button");
      if (first) first.focus();
      return () => {
        document.removeEventListener("mousedown", onDown, true);
        document.removeEventListener("keydown", onKey, true);
      };
    }, [open]);
    const items = boxes.concat(scrapers);
    const onMenuKey = (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const all = Array.prototype.slice.call(
        wrap.current.querySelectorAll(".roc-menu button")
      );
      const i = all.indexOf(document.activeElement);
      const n = e.key === "ArrowDown" ? (i + 1) % all.length : (i - 1 + all.length) % all.length;
      all[n].focus();
    };
    return /* @__PURE__ */ R.createElement("div", { className: "roc-source", ref: wrap }, /* @__PURE__ */ R.createElement(
      "button",
      {
        ref: btn,
        type: "button",
        className: "roc-source-btn",
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-label": "Search " + sourceLabel(source) + ". Choose where to search",
        onClick: () => setOpen(!open)
      },
      /* @__PURE__ */ R.createElement("span", null, sourceLabel(source) || "No source"),
      /* @__PURE__ */ R.createElement(Chevron, null)
    ), open ? /* @__PURE__ */ R.createElement("div", { className: "roc-menu", role: "menu", onKeyDown: onMenuKey }, boxes.length ? /* @__PURE__ */ R.createElement("div", { className: "roc-menu-head" }, "Stash-boxes") : null, boxes.map((s) => /* @__PURE__ */ R.createElement(
      "button",
      {
        key: "b" + s.endpoint,
        type: "button",
        role: "menuitemradio",
        "aria-checked": source === s,
        className: "roc-menu-item",
        onClick: () => {
          setOpen(false);
          choose(s);
        }
      },
      s.name
    )), scrapers.length ? /* @__PURE__ */ R.createElement("div", { className: "roc-menu-head" }, "Scrapers") : null, scrapers.map((s) => /* @__PURE__ */ R.createElement(
      "button",
      {
        key: "s" + s.id,
        type: "button",
        role: "menuitemradio",
        "aria-checked": source === s,
        className: "roc-menu-item",
        onClick: () => {
          setOpen(false);
          choose(s);
        }
      },
      s.name
    )), items.length ? /* @__PURE__ */ R.createElement("div", { className: "roc-menu-rule", role: "separator" }) : null, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        role: "menuitem",
        className: "roc-menu-item is-quiet",
        onClick: () => {
          if (!reloading) reload();
        },
        "aria-disabled": reloading
      },
      reloading ? "Reloading scrapers" : "Reload scrapers"
    )) : null);
  };
  const Candidate = ({ rec, source, index, total, width, fan, ringed, reading, tabbable, pick, onKey }) => {
    const { draft } = draftFromScraped(rec, source);
    const images = (rec.images || []).filter(Boolean);
    const img = images[0] || null;
    const year = birthYear(rec.birthdate);
    const country = countryName(rec.country);
    const aliases = draft.alias_list.length;
    const facts = [year ? "b. " + year : "", country].filter(Boolean).join(", ");
    const counts = [
      images.length ? plural(images.length, "image", "images") : "no image",
      aliases ? plural(aliases, "alias", "aliases") : ""
    ].filter(Boolean).join(", ");
    const label = (rec.name || "Unnamed") + (rec.disambiguation ? " (" + rec.disambiguation + ")" : "") + (facts ? ", " + facts : "") + ", " + counts;
    const mid = (total - 1) / 2;
    const style = fan ? { ["--roc-tilt"]: total > 1 ? (index - mid) * 8 / (total - 1) + "deg" : "0deg", ["--roc-lift"]: total > 1 ? Math.abs(index - mid) * (20 / Math.max(1, total - 1)) + "px" : "0px" } : {};
    return /* @__PURE__ */ R.createElement("li", { className: "roc-cand" + (ringed ? " is-ringed" : "") + (reading ? " is-reading" : ""), style }, /* @__PURE__ */ R.createElement("div", { className: "roc-cand-frame" }, /* @__PURE__ */ R.createElement(LiveCard, { performer: cardPerformer(draft, img, "new-" + index), width, cardKey: (img || "") + index, strip: statStrip(draft), fit: "row" }), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "roc-cand-hit roc-pick",
        tabIndex: tabbable ? 0 : -1,
        "data-index": index,
        "aria-label": "Use " + label,
        onClick: () => pick(index),
        onKeyDown: (e) => onKey(e, index),
        disabled: reading
      }
    ), reading ? /* @__PURE__ */ R.createElement("span", { className: "roc-cand-reading" }, "Reading ", source ? source.name : "") : null), /* @__PURE__ */ R.createElement("div", { className: "roc-cand-cap" }, rec.disambiguation ? /* @__PURE__ */ R.createElement("span", { className: "roc-cand-dis" }, rec.disambiguation) : null, facts ? /* @__PURE__ */ R.createElement("span", null, facts) : null, /* @__PURE__ */ R.createElement("span", { className: "roc-quiet" }, counts)));
  };
  const NameChip = ({ rec, source, index, ringed, reading, tabbable, pick, onKey }) => {
    const year = birthYear(rec.birthdate);
    const country = countryName(rec.country);
    const facts = [rec.disambiguation || "", year ? "b. " + year : "", country].filter(Boolean).join(", ");
    const label = (rec.name || "Unnamed") + (facts ? ", " + facts : "");
    return /* @__PURE__ */ R.createElement("li", { className: "roc-namechip-li" }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "roc-namechip roc-pick" + (ringed ? " is-ringed" : "") + (reading ? " is-reading" : ""),
        tabIndex: tabbable ? 0 : -1,
        "data-index": index,
        "aria-label": "Use " + label,
        "aria-busy": reading,
        onClick: () => {
          if (!reading) pick(index);
        },
        onKeyDown: (e) => onKey(e, index)
      },
      /* @__PURE__ */ R.createElement("span", { className: "roc-namechip-name" }, rec.name || "Unnamed"),
      facts ? /* @__PURE__ */ R.createElement("span", { className: "roc-namechip-facts" }, facts) : null,
      reading ? /* @__PURE__ */ R.createElement("span", { className: "roc-namechip-reading" }, "Reading ", source ? source.name : "") : null
    ));
  };
  const Stage = (p) => {
    const field = useRef(null);
    const list = useRef(null);
    const [focusIdx, setFocusIdx] = useState(0);
    useEffect(() => {
      const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (!coarse && field.current) field.current.focus();
    }, []);
    const results = p.search.status === "idle" ? [] : p.search.results;
    const shownSource = p.search.status === "idle" ? p.source : p.search.source;
    const loading = p.search.status === "loading";
    const zero = p.search.status === "done" && !results.length && !!p.query.trim();
    const failed = p.search.status === "error";
    const nameOnly = results.length > 0 && results.every((r) => !(r.images || []).filter(Boolean).length);
    const fan = !nameOnly && !p.narrow && results.length > 0 && results.length <= 5;
    const width = p.narrow ? Math.floor((Math.min(window.innerWidth, 600) - 32 - 18) / 2) : 200;
    useEffect(() => {
      setFocusIdx(p.lastPicked !== null && p.lastPicked < results.length ? p.lastPicked : 0);
    }, [results, p.lastPicked]);
    const focusCandidate = (i) => {
      const el = list.current && list.current.querySelector('.roc-pick[data-index="' + i + '"]');
      setFocusIdx(i);
      if (el) el.focus();
    };
    const onCandKey = (e, i) => {
      const n = results.length;
      let next = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = n - 1;
      else if (e.key === "Escape") {
        e.preventDefault();
        if (field.current) field.current.focus();
        return;
      }
      if (next >= 0) {
        e.preventDefault();
        focusCandidate(next);
      }
    };
    const retrying = useRef(false);
    const tryAgain = () => {
      retrying.current = true;
      if (field.current) field.current.focus();
      p.searchNow();
    };
    useEffect(() => {
      if (!retrying.current || p.search.status === "loading") return;
      retrying.current = false;
      if (p.search.status === "error") {
        const b = document.querySelector(".roc-plate.is-error .roc-retry");
        if (b) b.focus();
      }
    }, [p.search.status]);
    const nothingToPick = !results.length;
    const byHandRef = useRef(p.byHand);
    byHandRef.current = p.byHand;
    useEffect(() => {
      if (!nothingToPick) return void 0;
      const onKey = (e) => {
        if (e.key !== "Escape" || e.defaultPrevented) return;
        const a = document.activeElement;
        if (a && a !== document.body && a !== document.documentElement) return;
        e.preventDefault();
        byHandRef.current();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [nothingToPick]);
    const onFieldKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        p.searchNow();
      } else if (e.key === "Escape" && nothingToPick) {
        e.preventDefault();
        p.byHand();
      } else if (e.key === "ArrowDown" && results.length) {
        e.preventDefault();
        focusCandidate(focusIdx);
      }
    };
    const status = statusLine(p);
    const srcName = shownSource ? shownSource.name : "";
    const noSources = p.sourcesReady && !p.boxes.length && !p.scrapers.length;
    const typed = p.query.trim();
    return /* @__PURE__ */ R.createElement("section", { className: "roc-stage" + (results.length || zero || failed ? " has-answer" : ""), "aria-label": "Find a performer" }, /* @__PURE__ */ R.createElement("div", { className: "roc-field-wrap" }, /* @__PURE__ */ R.createElement("label", { className: "roc-sr", htmlFor: "roc-q" }, "Performer name or link"), /* @__PURE__ */ R.createElement("div", { className: "roc-field" + (loading ? " is-loading" : "") }, /* @__PURE__ */ R.createElement(
      "input",
      {
        id: "roc-q",
        ref: field,
        className: "roc-field-input",
        type: "text",
        autoComplete: "off",
        spellCheck: false,
        placeholder: "Performer name or link",
        value: p.query,
        onChange: (e) => p.setQuery(e.currentTarget.value),
        onKeyDown: onFieldKey,
        enterKeyHint: "search",
        "aria-describedby": "roc-status"
      }
    ), p.boxes.length || p.scrapers.length ? /* @__PURE__ */ R.createElement(
      SourceMenu,
      {
        source: p.source,
        boxes: p.boxes,
        scrapers: p.scrapers,
        choose: p.chooseSource,
        reload: p.reloadScrapers,
        reloading: p.reloading
      }
    ) : null), /* @__PURE__ */ R.createElement("p", { id: "roc-status", className: "roc-status", "aria-live": "polite" }, status || (!typed ? noSources ? "" : "Searches " + (srcName || "your sources") + " and your library as you type. Paste a link to read it with a scraper." : ""))), p.kept ? /* @__PURE__ */ R.createElement("p", { className: "roc-kept", role: "status" }, /* @__PURE__ */ R.createElement("span", null, p.kept.byHand ? "What you filled in for " : "Your changes to ", p.kept.name || "this performer", " ", p.kept.byHand ? "is" : "are", " kept."), /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-link", onClick: p.resumeKept }, "Go back to ", p.kept.byHand ? "it" : "them")) : null, noSources ? /* @__PURE__ */ R.createElement("div", { className: "roc-plate is-empty", role: "status" }, /* @__PURE__ */ R.createElement("p", { className: "roc-plate-line" }, "No stash-box or performer scraper is set up."), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-note" }, "Add a stash-box under Settings, Metadata providers, or fill the performer in by hand."), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-actions" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn is-primary", onClick: p.byHand }, "Fill in by hand"))) : null, p.sourcesError ? /* @__PURE__ */ R.createElement("div", { className: "roc-plate is-error", role: "alert" }, /* @__PURE__ */ R.createElement("p", { className: "roc-plate-line" }, "Your stash-boxes and scrapers could not be listed."), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-note" }, p.sourcesError)) : null, /* @__PURE__ */ R.createElement(LibraryPlate, { name: typed, list: p.dupes.list, count: p.dupes.count, open: p.openPerformer, onDifferent: p.differentPerson }), failed ? /* @__PURE__ */ R.createElement("div", { className: "roc-plate is-error", role: "alert" }, /* @__PURE__ */ R.createElement("p", { className: "roc-plate-line" }, srcName || "The source", " did not answer."), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-note" }, p.search.error, ". Try again, or fill the performer in by hand."), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-actions" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn is-primary roc-retry", onClick: tryAgain }, "Try again"), /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn", onClick: p.byHand }, "Fill in by hand"))) : null, zero ? /* @__PURE__ */ R.createElement("div", { className: "roc-plate is-empty", role: "status" }, /* @__PURE__ */ R.createElement("p", { className: "roc-plate-line" }, shownSource && shownSource.kind === "link" ? "No scraper could read that link." : "Nobody called " + typed + " on " + srcName + "."), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-note" }, "Add ", shownSource && shownSource.kind === "link" ? "the performer" : typed, " by hand and the card fills in as you type, or search another source."), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-actions" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn is-primary is-big", onClick: p.byHand }, "Add ", shownSource && shownSource.kind === "link" ? "by hand" : typed + " by hand"))) : null, p.readError ? /* @__PURE__ */ R.createElement("div", { className: "roc-plate is-error", role: "alert" }, /* @__PURE__ */ R.createElement("p", { className: "roc-plate-line" }, "That result could not be read."), /* @__PURE__ */ R.createElement("p", { className: "roc-plate-note" }, p.readError)) : null, nameOnly ? /* @__PURE__ */ R.createElement(
      "ul",
      {
        ref: list,
        className: "roc-namechips" + (loading ? " is-stale" : ""),
        "aria-label": status || "Results",
        "aria-busy": loading
      },
      results.map((rec, i) => /* @__PURE__ */ R.createElement(
        NameChip,
        {
          key: i + ":" + (rec.urls && rec.urls[0] || rec.name || ""),
          rec,
          source: shownSource,
          index: i,
          ringed: i === focusIdx,
          reading: p.reading === i,
          tabbable: i === focusIdx,
          pick: p.pick,
          onKey: onCandKey
        }
      ))
    ) : results.length ? /* @__PURE__ */ R.createElement(
      "ul",
      {
        ref: list,
        className: "roc-cands" + (fan ? " is-fan" : " is-grid") + (loading ? " is-stale" : ""),
        "aria-label": status || "Results",
        "aria-busy": loading
      },
      results.map((rec, i) => /* @__PURE__ */ R.createElement(
        Candidate,
        {
          key: i + ":" + (rec.remote_site_id || rec.name || ""),
          rec,
          source: shownSource,
          index: i,
          total: results.length,
          width,
          fan,
          ringed: i === focusIdx,
          reading: p.reading === i,
          tabbable: i === focusIdx,
          pick: p.pick,
          onKey: onCandKey
        }
      ))
    ) : null, /* @__PURE__ */ R.createElement("div", { className: "roc-exits" }, results.length ? /* @__PURE__ */ R.createElement("p", { className: "roc-quiet roc-exits-copy" }, nameOnly ? "Pick a name to read its record." : "Pick a card to use its record.", " Nothing is added until you say so.") : null, !noSources && !zero && !failed ? /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn", onClick: p.byHand }, "Fill in by hand") : null, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-link", onClick: p.useStashForm }, p.typedName ? "Use Stash's form with this name" : "Use Stash's form")));
  };
  const Faces = ({ frames, chosen, choose, add, sourceName, broken, markBroken, narrow }) => {
    const [adding, setAdding] = useState(false);
    const [url2, setUrl] = useState("");
    const [err, setErr] = useState(null);
    const fileInput = useRef(null);
    const urlInput = useRef(null);
    const wrap = useRef(null);
    const plus = useRef(null);
    const row = useRef(null);
    const [edges, setEdges] = useState({ start: false, end: false });
    const [loaded, setLoaded] = useState({});
    const [inView, setInView] = useState(null);
    useEffect(() => {
      const r = row.current;
      const IO = window.IntersectionObserver;
      if (!r || !IO) {
        setInView(null);
        return void 0;
      }
      const io = new IO(
        (entries) => {
          setInView((cur) => {
            let n = cur;
            entries.forEach((e) => {
              const f = frames[Number(e.target.getAttribute("data-face"))];
              if (!f) return;
              const src = f.src;
              const v = e.isIntersecting;
              if (!!(n && n[src]) === v) return;
              if (n === cur) n = { ...cur || {} };
              n[src] = v;
            });
            return n || {};
          });
        },
        { root: r, rootMargin: "0px 80px" }
      );
      r.querySelectorAll(".roc-face[data-face]").forEach((el) => io.observe(el));
      return () => io.disconnect();
    }, [frames]);
    const visible = (src) => inView === null || !!inView[src];
    const waiting = frames.some((f) => visible(f.src) && !loaded[f.src] && !broken[f.src]);
    useEffect(() => {
      if (!waiting) return void 0;
      const read = () => {
        const r = row.current;
        if (!r) return;
        const done = {};
        r.querySelectorAll("img").forEach((im) => {
          const src = im.getAttribute("src") || "";
          if (src && im.complete && im.naturalWidth > 0) done[src] = true;
        });
        setLoaded((l) => {
          const add2 = Object.keys(done).filter((k) => !l[k]);
          if (!add2.length) return l;
          const n = { ...l };
          add2.forEach((k) => n[k] = true);
          return n;
        });
      };
      read();
      let ticks = 0;
      const t = window.setInterval(() => {
        ticks += 1;
        read();
        if (ticks >= 28) window.clearInterval(t);
      }, 700);
      return () => window.clearInterval(t);
    }, [waiting, frames, broken, inView]);
    useEffect(() => {
      const r = row.current;
      if (!r) return void 0;
      const onWheel = (e) => {
        if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        const max = r.scrollWidth - r.clientWidth;
        if (max <= 1) return;
        const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * r.clientWidth : e.deltaY;
        if (step > 0 && r.scrollLeft >= max - 1) return;
        if (step < 0 && r.scrollLeft <= 1) return;
        e.preventDefault();
        r.scrollLeft = Math.max(0, Math.min(max, r.scrollLeft + step));
      };
      r.addEventListener("wheel", onWheel, { passive: false });
      return () => r.removeEventListener("wheel", onWheel);
    }, []);
    useEffect(() => {
      const r = row.current;
      if (!r) return void 0;
      const read = () => {
        const max = r.scrollWidth - r.clientWidth;
        const start2 = max > 1 && r.scrollLeft > 1;
        const end = max > 1 && r.scrollLeft < max - 1;
        setEdges((e) => e.start === start2 && e.end === end ? e : { start: start2, end });
      };
      read();
      r.addEventListener("scroll", read, { passive: true });
      const RO = window.ResizeObserver;
      const ro = RO ? new RO(read) : null;
      if (ro) ro.observe(r);
      window.addEventListener("resize", read);
      return () => {
        r.removeEventListener("scroll", read);
        if (ro) ro.disconnect();
        window.removeEventListener("resize", read);
      };
    }, [frames.length]);
    useEffect(() => {
      const r = row.current;
      if (!r || r.scrollWidth <= r.clientWidth) return;
      const el = r.querySelector(".roc-face.is-chosen");
      if (!el) return;
      const left = el.getBoundingClientRect().left - r.getBoundingClientRect().left + r.scrollLeft;
      if (left < r.scrollLeft || left + el.offsetWidth > r.scrollLeft + r.clientWidth) {
        r.scrollLeft = Math.max(0, left - (r.clientWidth - el.offsetWidth) / 2);
      }
    }, [chosen, frames.length]);
    const recordCount = frames.filter((f) => f.origin === "record").length;
    const current = chosen >= 0 ? frames[chosen] : null;
    useEffect(() => {
      if (!adding) return void 0;
      const onDown = (e) => {
        if (wrap.current && !wrap.current.contains(e.target)) setAdding(false);
      };
      const onKey = (e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        setAdding(false);
        if (plus.current) plus.current.focus();
      };
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
      return () => {
        document.removeEventListener("mousedown", onDown, true);
        document.removeEventListener("keydown", onKey, true);
      };
    }, [adding]);
    const onFile = async (e) => {
      const f = e.currentTarget.files && e.currentTarget.files[0];
      e.currentTarget.value = "";
      if (!f) return;
      if (!/^image\//.test(f.type)) {
        setErr("That file is not an image.");
        return;
      }
      try {
        const data = await fileToDataURL(f);
        setErr(null);
        add({ src: data, origin: "file" });
        setAdding(false);
      } catch (x) {
        setErr(x.message);
      }
    };
    const onUrl = () => {
      const v = url2.trim();
      if (!/^https?:\/\/\S+$/i.test(v) && !/^data:image\//.test(v)) {
        setErr("Paste a link that starts with http:// or https://.");
        if (urlInput.current) urlInput.current.focus();
        return;
      }
      setErr(null);
      add({ src: v, origin: "link" });
      setUrl("");
      setAdding(false);
    };
    const size = narrow ? { w: 48, h: 72 } : { w: 58, h: 87 };
    let which;
    if (!current) {
      which = /* @__PURE__ */ R.createElement("span", { className: "roc-faces-which" }, "No picture. Stash gives the performer its default one.");
    } else if (current.origin === "record") {
      which = /* @__PURE__ */ R.createElement("span", { className: "roc-faces-which" }, "Picture ", chosen + 1, " of ", recordCount, /* @__PURE__ */ R.createElement("span", { className: "roc-muted" }, ", from ", sourceName, "."));
    } else {
      which = /* @__PURE__ */ R.createElement("span", { className: "roc-faces-which" }, current.origin === "file" ? "Your file." : "Your link.");
    }
    return /* @__PURE__ */ R.createElement("div", { className: "roc-faces", ref: wrap }, adding ? /* @__PURE__ */ R.createElement("div", { className: "roc-add", id: "roc-add-image", role: "group", "aria-label": "Add a picture" }, /* @__PURE__ */ R.createElement("label", { className: "roc-add-label", htmlFor: "roc-add-url" }, "From a link"), /* @__PURE__ */ R.createElement("div", { className: "roc-add-row" }, /* @__PURE__ */ R.createElement(
      "input",
      {
        id: "roc-add-url",
        ref: urlInput,
        className: "form-control",
        type: "url",
        placeholder: "https://",
        value: url2,
        onChange: (e) => setUrl(e.currentTarget.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onUrl();
          }
        }
      }
    ), /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn", onClick: onUrl }, "Use link")), /* @__PURE__ */ R.createElement("div", { className: "roc-add-row is-file" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn", onClick: () => fileInput.current && fileInput.current.click() }, "Choose a file"), /* @__PURE__ */ R.createElement("span", { className: "roc-muted" }, "or paste an image anywhere on the page"), /* @__PURE__ */ R.createElement(
      "input",
      {
        ref: fileInput,
        className: "roc-file",
        type: "file",
        accept: ".jpg,.jpeg,.png,.webp,.gif",
        tabIndex: -1,
        "aria-hidden": "true",
        onChange: onFile
      }
    )), err ? /* @__PURE__ */ R.createElement("p", { className: "roc-field-err", role: "alert" }, err) : null) : null, /* @__PURE__ */ R.createElement("div", { className: "roc-faces-strip" + (frames.length ? "" : " is-empty") }, /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "roc-faces-row" + (edges.start ? " fade-start" : "") + (edges.end ? " fade-end" : ""),
        ref: row,
        role: "group",
        "aria-label": "Choose the picture to store"
      },
      frames.map((f, i) => /* @__PURE__ */ R.createElement(
        "button",
        {
          key: i + f.src.slice(0, 80),
          type: "button",
          className: "roc-face" + (i === chosen ? " is-chosen" : "") + (broken[f.src] ? " is-broken" : loaded[f.src] ? "" : visible(f.src) ? " is-loading" : " is-pending"),
          "data-face": i,
          "aria-busy": !broken[f.src] && !loaded[f.src],
          "aria-pressed": i === chosen,
          "aria-label": (f.origin === "record" ? "Picture " + (i + 1) + " of " + recordCount : f.origin === "file" ? "Your file" : "Your link") + (broken[f.src] ? ", did not load" : ""),
          style: { width: size.w, height: size.h },
          onClick: () => choose(i)
        },
        /* @__PURE__ */ R.createElement(
          "img",
          {
            src: f.src,
            alt: "",
            loading: visible(f.src) ? "eager" : "lazy",
            onLoad: () => setLoaded((l) => l[f.src] ? l : { ...l, [f.src]: true }),
            onError: () => markBroken(f.src)
          }
        ),
        broken[f.src] ? /* @__PURE__ */ R.createElement("span", { className: "roc-face-broken" }, "Did not load") : null
      ))
    ), /* @__PURE__ */ R.createElement(
      "button",
      {
        ref: plus,
        type: "button",
        className: "roc-face is-add" + (adding ? " is-open" : ""),
        "aria-expanded": adding,
        "aria-controls": "roc-add-image",
        "aria-label": "Add a picture from a link or a file",
        title: "Add a picture from a link or a file",
        style: { width: size.w, height: size.h },
        onClick: () => {
          setAdding(!adding);
          setErr(null);
          window.setTimeout(() => {
            if (urlInput.current) urlInput.current.focus();
          }, 0);
        }
      },
      /* @__PURE__ */ R.createElement(PlusGlyph, null)
    )), /* @__PURE__ */ R.createElement("p", { className: "roc-faces-cap", "aria-live": "polite" }, which, current && broken[current.src] ? /* @__PURE__ */ R.createElement("span", { className: "roc-warn" }, " It did not load here, so Stash may not be able to fetch it either.") : null, current ? /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-link is-quiet roc-faces-none", onClick: () => choose(-1) }, "Use no picture") : null));
  };
  const FIELD_ORDER = [
    "name",
    "disambiguation",
    "alias_list",
    "gender",
    "birthdate",
    "death_date",
    "country",
    "ethnicity",
    "hair_color",
    "eye_color",
    "height_cm",
    "weight",
    "penis_length",
    "circumcised",
    "measurements",
    "fake_tits",
    "tattoos",
    "piercings",
    "career_start",
    "career_end",
    "urls",
    "details",
    "tags",
    "stash_ids",
    "ignore_auto_tag",
    "custom_fields"
  ];
  function fieldId(k) {
    return "roc-f-" + k;
  }
  const Row = ({ k, label, span = "half", problem, children, labelFor = true }) => /* @__PURE__ */ R.createElement("div", { className: "roc-row is-" + span + (problem ? " has-problem" : ""), id: fieldId(k), "data-field": k }, labelFor ? /* @__PURE__ */ R.createElement("label", { className: "roc-row-label", htmlFor: fieldId(k) + "-in" }, label) : /* @__PURE__ */ R.createElement("span", { className: "roc-row-label", id: fieldId(k) + "-label" }, label), children, problem ? /* @__PURE__ */ R.createElement("p", { className: "roc-field-err", id: fieldId(k) + "-err", role: "alert" }, problem) : null);
  const Text = ({ k, value, update, problem, type = "text", multiline, placeholder, inputMode }) => {
    const common = {
      id: fieldId(k) + "-in",
      className: "form-control",
      value,
      placeholder,
      "aria-invalid": problem ? true : void 0,
      "aria-describedby": problem ? fieldId(k) + "-err" : void 0
    };
    if (multiline) {
      return /* @__PURE__ */ R.createElement(
        "textarea",
        {
          ...common,
          rows: 3,
          onChange: (e) => update(k, e.currentTarget.value)
        }
      );
    }
    return /* @__PURE__ */ R.createElement(
      "input",
      {
        ...common,
        type,
        inputMode,
        onChange: (e) => update(k, e.currentTarget.value)
      }
    );
  };
  const Choice = ({ k, value, update, table }) => /* @__PURE__ */ R.createElement(
    "select",
    {
      id: fieldId(k) + "-in",
      className: "form-control roc-select",
      value,
      onChange: (e) => update(k, e.currentTarget.value)
    },
    /* @__PURE__ */ R.createElement("option", { value: "" }, "Not set"),
    table.map(([v, l]) => /* @__PURE__ */ R.createElement("option", { key: v, value: v }, l))
  );
  const DateField = ({
    k,
    value,
    update,
    problem
  }) => {
    const DateInput = stashComponent("DateInput");
    if (!DateInput) return /* @__PURE__ */ R.createElement(Text, { k, value, update, problem, placeholder: "YYYY-MM-DD" });
    return /* @__PURE__ */ R.createElement("div", { className: "roc-stash-control", id: fieldId(k) + "-in" }, /* @__PURE__ */ R.createElement(DateInput, { value, onValueChange: (v) => update(k, v) }));
  };
  const StringList = ({ k, values, update, addLabel, itemLabel, type = "text" }) => {
    const list = values.length ? values : [""];
    const set = (i, v) => {
      const next = list.slice();
      next[i] = v;
      update(k, next);
    };
    const remove = (i) => {
      const next = list.slice();
      next.splice(i, 1);
      update(k, next);
    };
    return /* @__PURE__ */ R.createElement("div", { className: "roc-list", role: "group", "aria-labelledby": fieldId(k) + "-label" }, list.map((v, i) => /* @__PURE__ */ R.createElement("div", { className: "roc-list-row", key: i }, /* @__PURE__ */ R.createElement(
      "input",
      {
        id: i === 0 ? fieldId(k) + "-in" : void 0,
        className: "form-control",
        type,
        value: v,
        "aria-label": itemLabel + " " + (i + 1),
        onChange: (e) => set(i, e.currentTarget.value)
      }
    ), list.length > 1 || v ? /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-icon-btn", "aria-label": "Remove " + itemLabel.toLowerCase() + " " + (i + 1), onClick: () => remove(i) }, /* @__PURE__ */ R.createElement(CrossGlyph, null)) : null)), /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn is-small", onClick: () => update(k, list.concat([""])) }, /* @__PURE__ */ R.createElement(PlusGlyph, null), " ", addLabel));
  };
  const StashIds = ({ values, update, boxes }) => {
    const endpoints = boxes.map((b) => b.kind === "box" ? b.endpoint : "").filter(Boolean);
    const nameOf = (ep) => {
      const b = boxes.find((x) => x.kind === "box" && x.endpoint === ep);
      return b ? b.name : ep;
    };
    const set = (i, patch) => {
      const next = values.slice();
      next[i] = { ...next[i], ...patch };
      update("stash_ids", next);
    };
    return /* @__PURE__ */ R.createElement("div", { className: "roc-list", role: "group", "aria-labelledby": fieldId("stash_ids") + "-label" }, values.map((v, i) => /* @__PURE__ */ R.createElement("div", { className: "roc-list-row is-id", key: i }, /* @__PURE__ */ R.createElement(
      "select",
      {
        id: i === 0 ? fieldId("stash_ids") + "-in" : void 0,
        className: "form-control roc-select",
        "aria-label": "Stash-box for stash ID " + (i + 1),
        value: v.endpoint,
        onChange: (e) => set(i, { endpoint: e.currentTarget.value })
      },
      endpoints.indexOf(v.endpoint) < 0 && v.endpoint ? /* @__PURE__ */ R.createElement("option", { value: v.endpoint }, v.endpoint) : null,
      !v.endpoint ? /* @__PURE__ */ R.createElement("option", { value: "" }, "Choose a stash-box") : null,
      endpoints.map((ep) => /* @__PURE__ */ R.createElement("option", { key: ep, value: ep }, nameOf(ep)))
    ), /* @__PURE__ */ R.createElement(
      "input",
      {
        className: "form-control",
        "aria-label": "Stash ID " + (i + 1),
        value: v.stash_id,
        onChange: (e) => set(i, { stash_id: e.currentTarget.value })
      }
    ), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "roc-icon-btn",
        "aria-label": "Remove stash ID " + (i + 1),
        onClick: () => {
          const next = values.slice();
          next.splice(i, 1);
          update("stash_ids", next);
        }
      },
      /* @__PURE__ */ R.createElement(CrossGlyph, null)
    ))), /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "roc-btn is-small",
        id: values.length ? void 0 : fieldId("stash_ids") + "-in",
        disabled: !endpoints.length,
        onClick: () => update("stash_ids", values.concat([{ endpoint: endpoints[0] || "", stash_id: "" }]))
      },
      /* @__PURE__ */ R.createElement(PlusGlyph, null),
      " Add a stash ID"
    ), !endpoints.length ? /* @__PURE__ */ R.createElement("p", { className: "roc-quiet" }, "Stash IDs belong to a stash-box, and none is set up.") : null);
  };
  const UnmatchedTags = ({ names, source, create }) => {
    const [busy, setBusy] = useState(null);
    const [err, setErr] = useState(null);
    const box = useRef(null);
    if (!names.length) return null;
    return /* @__PURE__ */ R.createElement("div", { className: "roc-unmatched", ref: box }, /* @__PURE__ */ R.createElement("p", { className: "roc-quiet" }, names.length === 1 ? "1 tag" : names.length + " tags", " from ", source, " ", names.length === 1 ? "is" : "are", " not in your library. Add any you want as a new tag; the rest are left out."), /* @__PURE__ */ R.createElement("div", { className: "roc-chips" }, names.map((n) => /* @__PURE__ */ R.createElement(
      "button",
      {
        key: n,
        type: "button",
        className: "roc-chip is-add",
        "aria-disabled": busy === n,
        onClick: async () => {
          if (busy) return;
          setBusy(n);
          setErr(null);
          const row = box.current && box.current.closest(".roc-row");
          try {
            await create(n);
            window.setTimeout(() => {
              const next = box.current && box.current.querySelector(".roc-chip.is-add") || row && row.querySelector("input.react-select__input, input:not([type=hidden])");
              if (next) next.focus();
            }, 0);
          } catch (e) {
            setErr(e.message || String(e));
          }
          setBusy(null);
        }
      },
      /* @__PURE__ */ R.createElement(PlusGlyph, null),
      " ",
      busy === n ? "Adding " + n : n
    ))), err ? /* @__PURE__ */ R.createElement("p", { className: "roc-field-err", role: "alert" }, err) : null);
  };
  const Section = ({ title, children }) => /* @__PURE__ */ R.createElement("fieldset", { className: "roc-sec" }, /* @__PURE__ */ R.createElement("legend", { className: "roc-eyebrow" }, title), /* @__PURE__ */ R.createElement("div", { className: "roc-sec-grid" }, children));
  const DetailsForm = ({ draft, update, problems, boxes, unmatched, unmatchedSource, createTag, focusField, focused, customError, setCustomError }) => {
    const root = useRef(null);
    useEffect(() => {
      if (!focusField || !root.current) return;
      const row = root.current.querySelector("#" + fieldId(focusField));
      if (row) {
        const target = row.querySelector(
          "input:not([type=hidden]):not([tabindex='-1']), select, textarea, button"
        );
        try {
          row.scrollIntoView({ block: "center" });
        } catch {
        }
        if (target) target.focus();
      }
      focused();
    }, [focusField, focused]);
    const CountrySelect = stashComponent("CountrySelect");
    const TagSelect = stashComponent("TagSelect");
    const CustomFieldsInput = stashComponent("CustomFieldsInput");
    const t = (k, label, span = "half", extra = {}) => /* @__PURE__ */ R.createElement(Row, { k, label, span, problem: problems[k] }, /* @__PURE__ */ R.createElement(Text, { k, value: String(draft[k] || ""), update, problem: problems[k], ...extra }));
    return /* @__PURE__ */ R.createElement("div", { className: "roc-form", ref: root }, /* @__PURE__ */ R.createElement(Section, { title: "Identity" }, t("name", "Name", "full"), t("disambiguation", "Disambiguation", "half"), /* @__PURE__ */ R.createElement(Row, { k: "gender", label: "Gender" }, /* @__PURE__ */ R.createElement(Choice, { k: "gender", value: draft.gender, update, table: GENDERS })), /* @__PURE__ */ R.createElement(Row, { k: "alias_list", label: "Aliases", span: "full", labelFor: false }, /* @__PURE__ */ R.createElement(StringList, { k: "alias_list", values: draft.alias_list, update, addLabel: "Add an alias", itemLabel: "Alias" }))), /* @__PURE__ */ R.createElement(Section, { title: "Appearance" }, /* @__PURE__ */ R.createElement(Row, { k: "birthdate", label: "Birthdate", span: "half", problem: problems.birthdate }, /* @__PURE__ */ R.createElement(DateField, { k: "birthdate", value: draft.birthdate, update, problem: problems.birthdate })), /* @__PURE__ */ R.createElement(Row, { k: "death_date", label: "Death date", span: "half", problem: problems.death_date }, /* @__PURE__ */ R.createElement(DateField, { k: "death_date", value: draft.death_date, update, problem: problems.death_date })), /* @__PURE__ */ R.createElement(Row, { k: "country", label: "Country", span: "wide", labelFor: !CountrySelect }, CountrySelect ? /* @__PURE__ */ R.createElement("div", { className: "roc-stash-control", "aria-labelledby": fieldId("country") + "-label" }, /* @__PURE__ */ R.createElement(
      CountrySelect,
      {
        value: draft.country,
        onChange: (v) => update("country", v || ""),
        showFlag: true,
        menuPortalTarget: document.body
      }
    )) : /* @__PURE__ */ R.createElement(Text, { k: "country", value: draft.country, update })), t("ethnicity", "Ethnicity", "third"), t("hair_color", "Hair colour", "third"), t("eye_color", "Eye colour", "third"), t("height_cm", "Height (cm)", "third", { inputMode: "numeric" }), t("weight", "Weight (kg)", "third", { inputMode: "numeric" }), t("measurements", "Measurements", "third"), t("fake_tits", "Fake tits", "third"), t("penis_length", "Penis length (cm)", "half", { inputMode: "decimal" }), /* @__PURE__ */ R.createElement(Row, { k: "circumcised", label: "Circumcised", span: "half" }, /* @__PURE__ */ R.createElement(Choice, { k: "circumcised", value: draft.circumcised, update, table: CIRCUMCISED }))), /* @__PURE__ */ R.createElement(Section, { title: "Marks and notes" }, t("tattoos", "Tattoos", "half", { multiline: true }), t("piercings", "Piercings", "half", { multiline: true }), t("details", "Details", "full", { multiline: true })), /* @__PURE__ */ R.createElement(Section, { title: "Career" }, /* @__PURE__ */ R.createElement(Row, { k: "career_start", label: "Career start", problem: problems.career_start }, /* @__PURE__ */ R.createElement(DateField, { k: "career_start", value: draft.career_start, update, problem: problems.career_start })), /* @__PURE__ */ R.createElement(Row, { k: "career_end", label: "Career end", problem: problems.career_end }, /* @__PURE__ */ R.createElement(DateField, { k: "career_end", value: draft.career_end, update, problem: problems.career_end }))), /* @__PURE__ */ R.createElement(Section, { title: "Links and identifiers" }, /* @__PURE__ */ R.createElement(Row, { k: "urls", label: "Links", span: "full", problem: problems.urls, labelFor: false }, /* @__PURE__ */ R.createElement(StringList, { k: "urls", values: draft.urls, update, addLabel: "Add a link", itemLabel: "Link", type: "url" })), /* @__PURE__ */ R.createElement(Row, { k: "stash_ids", label: "Stash IDs", span: "full", labelFor: false }, /* @__PURE__ */ R.createElement(StashIds, { values: draft.stash_ids, update, boxes }))), /* @__PURE__ */ R.createElement(Section, { title: "Tags" }, /* @__PURE__ */ R.createElement(Row, { k: "tags", label: "Tags", span: "full", labelFor: false }, TagSelect ? /* @__PURE__ */ R.createElement("div", { className: "roc-stash-control", "aria-labelledby": fieldId("tags") + "-label" }, /* @__PURE__ */ R.createElement(
      TagSelect,
      {
        isMulti: true,
        creatable: true,
        values: draft.tags,
        onSelect: (items) => update("tags", items.map((x) => ({ id: String(x.id), name: x.name }))),
        menuPortalTarget: document.body
      }
    )) : /* @__PURE__ */ R.createElement("p", { className: "roc-quiet" }, "Stash's tag picker is not available here; add tags on the performer's page after adding."), /* @__PURE__ */ R.createElement(UnmatchedTags, { names: unmatched, source: unmatchedSource, create: createTag }))), /* @__PURE__ */ R.createElement(Section, { title: "Options" }, /* @__PURE__ */ R.createElement("div", { className: "roc-row is-full", id: fieldId("ignore_auto_tag"), "data-field": "ignore_auto_tag" }, /* @__PURE__ */ R.createElement("label", { className: "roc-check" }, /* @__PURE__ */ R.createElement(
      "input",
      {
        type: "checkbox",
        id: fieldId("ignore_auto_tag") + "-in",
        checked: draft.ignore_auto_tag,
        onChange: (e) => update("ignore_auto_tag", e.currentTarget.checked)
      }
    ), /* @__PURE__ */ R.createElement("span", null, "Ignore auto tag")))), /* @__PURE__ */ R.createElement(Section, { title: "Custom fields" }, /* @__PURE__ */ R.createElement("div", { className: "roc-row is-full", id: fieldId("custom_fields"), "data-field": "custom_fields" }, CustomFieldsInput ? /* @__PURE__ */ R.createElement("div", { className: "roc-stash-control roc-custom" }, /* @__PURE__ */ R.createElement(
      CustomFieldsInput,
      {
        values: draft.custom_fields,
        onChange: (v) => update("custom_fields", v),
        error: customError,
        setError: setCustomError
      }
    )) : /* @__PURE__ */ R.createElement("p", { className: "roc-quiet" }, "Stash's custom field editor is not available here; add them on the performer's page after adding."))));
  };
  const intlLib = pluginApi() && pluginApi().libraries && pluginApi().libraries.Intl;
  const useIntlHook = intlLib && intlLib.useIntl;
  function useStashLocale() {
    if (typeof useIntlHook === "function") {
      const intl = useIntlHook();
      if (intl && intl.locale) return intl.locale;
    }
    try {
      return navigator.language || void 0;
    } catch {
      return void 0;
    }
  }
  const cache = {};
  function formatter(locale, opts, key) {
    const k = (locale || "") + "|" + key;
    if (k in cache) return cache[k];
    try {
      cache[k] = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });
    } catch {
      try {
        cache[k] = new Intl.DateTimeFormat(void 0, { ...opts, timeZone: "UTC" });
      } catch {
        cache[k] = null;
      }
    }
    return cache[k];
  }
  function fuzzyDate(value, locale) {
    const v = (value || "").trim();
    if (!v) return "";
    let m = /^(\d{4})$/.exec(v);
    if (m) {
      const f = formatter(locale, { year: "numeric" }, "y");
      return f ? f.format(Date.UTC(Number(m[1]), 0)) : v;
    }
    m = /^(\d{4})-(\d{2})$/.exec(v);
    if (m) {
      const mo = Number(m[2]);
      if (mo < 1 || mo > 12) return v;
      const f = formatter(locale, { year: "numeric", month: "long" }, "ym");
      return f ? f.format(Date.UTC(Number(m[1]), mo - 1)) : v;
    }
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const t = Date.UTC(y, mo - 1, d);
      const back = new Date(t);
      if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return v;
      const f = formatter(locale, { year: "numeric", month: "long", day: "numeric" }, "ymd");
      return f ? f.format(t) : v;
    }
    return v;
  }
  function join(parts, sep = ", ") {
    return parts.filter(Boolean).join(sep);
  }
  function marks(key, text, word, field) {
    const n = text.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean).length;
    const label = n > 1 ? n + " " + word : word.charAt(0).toUpperCase() + word.slice(1);
    return { key, label, value: /* @__PURE__ */ R.createElement("span", { className: "roc-back-clamp" }, text), field, title: text };
  }
  function breasts(v) {
    return v.trim().toLowerCase();
  }
  function readoutLines(d, boxName, unmatched, locale) {
    const lines = [];
    const height = d.height_cm ? d.height_cm + " cm" : "";
    const weight = d.weight ? d.weight + " kg" : "";
    const date = (v) => fuzzyDate(v, locale);
    const career = d.career_start || d.career_end ? (d.career_start ? date(d.career_start) : "Unknown") + " to " + (d.career_end ? date(d.career_end) : "present") : "";
    if (d.alias_list.length) {
      lines.push({ key: "aliases", label: "Also known as", value: d.alias_list.join(", "), field: "alias_list", wide: true });
    }
    if (d.disambiguation) {
      lines.push({ key: "dis", label: "Disambiguation", value: d.disambiguation, field: "disambiguation" });
    }
    if (d.birthdate) lines.push({ key: "born", label: "Born", value: date(d.birthdate), field: "birthdate" });
    if (d.death_date) lines.push({ key: "died", label: "Died", value: date(d.death_date), field: "death_date" });
    if (d.gender || d.country) {
      lines.push({
        key: "gc",
        label: d.gender && d.country ? "Gender and country" : d.gender ? "Gender" : "Country",
        value: join([d.gender ? enumLabel(d.gender, GENDERS) : "", countryName(d.country)]),
        field: d.gender ? "gender" : "country"
      });
    }
    if (d.ethnicity) lines.push({ key: "eth", label: "Ethnicity", value: d.ethnicity, field: "ethnicity" });
    if (height || weight) {
      lines.push({
        key: "hw",
        label: height && weight ? "Height and weight" : height ? "Height" : "Weight",
        value: join([height, weight]),
        field: height ? "height_cm" : "weight"
      });
    }
    if (d.hair_color || d.eye_color) {
      lines.push({
        key: "he",
        label: d.hair_color && d.eye_color ? "Hair and eyes" : d.hair_color ? "Hair" : "Eyes",
        value: join([d.hair_color, d.eye_color]),
        field: d.hair_color ? "hair_color" : "eye_color"
      });
    }
    if (d.measurements) {
      lines.push({
        key: "meas",
        label: "Measurements",
        value: join([d.measurements, d.fake_tits ? breasts(d.fake_tits) : ""]),
        field: "measurements"
      });
    } else if (d.fake_tits) {
      lines.push({ key: "ft", label: "Breasts", value: d.fake_tits, field: "fake_tits" });
    }
    if (d.penis_length || d.circumcised) {
      lines.push({
        key: "pl",
        label: "Penis",
        value: join([d.penis_length ? d.penis_length + " cm" : "", d.circumcised ? enumLabel(d.circumcised, CIRCUMCISED).toLowerCase() : ""]),
        field: d.penis_length ? "penis_length" : "circumcised"
      });
    }
    if (career) lines.push({ key: "career", label: "Career", value: career, field: "career_start" });
    if (d.tattoos) lines.push(marks("tat", d.tattoos, "tattoos", "tattoos"));
    if (d.piercings) lines.push(marks("pie", d.piercings, "piercings", "piercings"));
    const urls = d.urls.filter(Boolean);
    if (urls.length || d.stash_ids.length) {
      lines.push({
        key: "links",
        label: "Links",
        field: urls.length ? "urls" : "stash_ids",
        wide: true,
        value: /* @__PURE__ */ R.createElement("span", { className: "roc-chips is-static" }, d.stash_ids.map((s) => /* @__PURE__ */ R.createElement("span", { className: "roc-chip is-id", key: s.endpoint + s.stash_id }, boxName(s.endpoint))), urls.slice(0, 3).map((u) => /* @__PURE__ */ R.createElement("span", { className: "roc-chip", key: u }, u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0])), urls.length > 3 ? /* @__PURE__ */ R.createElement("span", { className: "roc-chip is-more" }, urls.length - 3, " more") : null)
      });
    }
    if (d.tags.length || unmatched.length) {
      lines.push({
        key: "tags",
        label: "Tags",
        field: "tags",
        wide: true,
        value: /* @__PURE__ */ R.createElement(R.Fragment, null, /* @__PURE__ */ R.createElement("span", { className: "roc-chips is-static" }, d.tags.map((t) => /* @__PURE__ */ R.createElement("span", { className: "roc-chip", key: t.id }, t.name)), unmatched.map((n) => /* @__PURE__ */ R.createElement("span", { className: "roc-chip is-add", key: "u" + n }, n))), unmatched.length ? /* @__PURE__ */ R.createElement("span", { className: "roc-back-note" }, unmatched.length === 1 ? "The dashed tag is" : "The " + unmatched.length + " dashed tags are", " not in your library and ", unmatched.length === 1 ? "is" : "are", " left out unless you add ", unmatched.length === 1 ? "it" : "them", ".") : null)
      });
    }
    if (d.details) {
      lines.push({
        key: "details",
        label: "Details",
        field: "details",
        wide: true,
        title: d.details,
        value: /* @__PURE__ */ R.createElement("span", { className: "roc-back-clamp is-three" }, d.details)
      });
    }
    const customCount = Object.keys(d.custom_fields).length;
    if (customCount) {
      lines.push({
        key: "custom",
        label: "Custom fields",
        field: "custom_fields",
        value: customCount === 1 ? "1 field" : customCount + " fields"
      });
    }
    if (d.ignore_auto_tag) {
      lines.push({ key: "iat", label: "Auto tag", value: "Ignored", field: "ignore_auto_tag" });
    }
    return lines;
  }
  const Readouts = ({ draft, boxes, unmatched, open }) => {
    const boxName = (ep) => {
      const b = boxes.find((x) => x.kind === "box" && x.endpoint === ep);
      return b ? b.name : ep.replace(/^https?:\/\//, "").replace(/\/graphql$/, "");
    };
    const locale = useStashLocale();
    const lines = readoutLines(draft, boxName, unmatched, locale);
    if (!lines.length) {
      return /* @__PURE__ */ R.createElement("p", { className: "roc-back-empty" }, "Nothing but a name yet. Correct something to add the rest; the card follows as you type.");
    }
    const placed = lines.map((l, i) => {
      if (l.wide) return { l, span: true };
      let before = 0;
      for (let j = i - 1; j >= 0 && !lines[j].wide; j--) before++;
      const next = lines[i + 1];
      const alone = before % 2 === 0 && (!next || next.wide);
      return { l, span: alone };
    });
    return /* @__PURE__ */ R.createElement("ul", { className: "roc-back-lines", "aria-label": "The record" }, placed.map(({ l, span }) => /* @__PURE__ */ R.createElement("li", { key: l.key, className: "roc-back-li" + (span ? " is-wide" : "") }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-line", title: l.title, onClick: (e) => open(l.field, e.currentTarget) }, /* @__PURE__ */ R.createElement("span", { className: "roc-line-label" }, l.label), /* @__PURE__ */ R.createElement("span", { className: "roc-line-value" }, l.value), /* @__PURE__ */ R.createElement("span", { className: "roc-sr" }, ", change")))));
  };
  const Drawer = ({ open, onClose, title, note, foot, stage, fallback, children }) => {
    const opener = useRef(null);
    const panel = useRef(null);
    const [top, setTop] = R.useState(null);
    R.useLayoutEffect(() => {
      if (!open) return;
      let y = null;
      try {
        const nav = document.querySelector("nav.navbar, .navbar");
        const r = nav && nav.getBoundingClientRect();
        if (r && r.height > 0 && r.bottom > 0 && r.bottom < 200) y = Math.round(r.bottom + 12);
      } catch {
      }
      setTop(y);
    }, [open]);
    if (open && !opener.current) opener.current = document.activeElement;
    useEffect(() => {
      if (!open) return void 0;
      const st = stage.current;
      if (st) st.setAttribute("inert", "");
      const onKey = (e) => {
        if (e.key !== "Escape") return;
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("aria-expanded") === "true") return;
        if (document.querySelector(".react-datepicker-popper")) return;
        onClose();
      };
      document.addEventListener("keydown", onKey, true);
      return () => {
        document.removeEventListener("keydown", onKey, true);
        if (st) st.removeAttribute("inert");
        const back = opener.current;
        opener.current = null;
        window.setTimeout(() => {
          const live = back && back !== document.body && document.contains(back) ? back : null;
          const to = live || (fallback ? document.querySelector(fallback) : null);
          if (to) to.focus({ preventScroll: true });
        }, 0);
      };
    }, [open, onClose, stage, fallback]);
    if (!open) return null;
    return /* @__PURE__ */ R.createElement(R.Fragment, null, /* @__PURE__ */ R.createElement("div", { className: "roc-scrim", onClick: onClose, "aria-hidden": "true" }), /* @__PURE__ */ R.createElement(
      "div",
      {
        className: "roc-drawer",
        ref: panel,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": title,
        style: top !== null ? { ["--roc-drawer-top"]: top + "px" } : void 0
      },
      /* @__PURE__ */ R.createElement("div", { className: "roc-drawer-head" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-btn", onClick: onClose }, "Back to the card"), /* @__PURE__ */ R.createElement("p", { className: "roc-drawer-note" }, note)),
      /* @__PURE__ */ R.createElement("div", { className: "roc-drawer-body" }, children),
      /* @__PURE__ */ R.createElement("div", { className: "roc-drawer-foot" }, foot)
    ));
  };
  const MAIN_BOX = 30;
  const MALE_BOX = 6;
  const SILHOUETTE = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-136 -284 720 1080"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z" fill="#fff"/></svg>'
  ) + "#default=true";
  function fnv64a(s) {
    const bytes = new TextEncoder().encode(s);
    let h = BigInt("0xcbf29ce484222325");
    const prime = BigInt("0x100000001b3");
    const mask = BigInt("0xffffffffffffffff");
    for (let i = 0; i < bytes.length; i++) {
      h ^= BigInt(bytes[i]);
      h = h * prime & mask;
    }
    return h;
  }
  function isMale(gender) {
    return gender === "MALE" || gender === "TRANSGENDER_MALE";
  }
  function slot(name, gender) {
    const male = isMale(gender);
    const n = male ? MALE_BOX : MAIN_BOX;
    return (male ? "m" : "f") + String(fnv64a(name) % BigInt(n));
  }
  const Q = 'query RefractCreateDefaults { configuration { interface { sfwContentMode } } findPerformers(filter: { per_page: -1, sort: "id", direction: ASC }) { performers { id name gender } } }';
  function url(id) {
    return "/performer/" + encodeURIComponent(id) + "/image?default=true";
  }
  async function bytesOf(id) {
    const r = await fetch(url(id), { credentials: "same-origin" });
    if (!r.ok) throw new Error("status " + r.status);
    const b = new Uint8Array(await r.arrayBuffer());
    let h = 0;
    for (let i = 0; i < b.length; i++) h = h * 31 + b[i] | 0;
    return b.length + ":" + h;
  }
  let pending = null;
  function load() {
    if (pending) return pending;
    pending = (async () => {
      const c = apolloClient();
      const doc = gqlDoc(Q);
      if (!c || !doc) return { mode: "none", any: null, bySlot: {} };
      const r = await c.query({ query: doc, variables: {}, fetchPolicy: "network-only" });
      const d = r.data || {};
      const list = d.findPerformers && d.findPerformers.performers || [];
      if (!list.length) return { mode: "none", any: null, bySlot: {} };
      const any = String(list[0].id);
      if (d.configuration && d.configuration.interface && d.configuration.interface.sfwContentMode) {
        return { mode: "one", any, bySlot: {} };
      }
      const bySlot = {};
      const members = {};
      for (const p of list) {
        const k = slot(p.name, p.gender);
        if (!bySlot[k]) bySlot[k] = String(p.id);
        (members[k] = members[k] || []).push(String(p.id));
      }
      const shared = Object.keys(members).find((k) => k[0] === "f" && members[k].length >= 2);
      const keys = Object.keys(bySlot).filter((k) => k[0] === "f");
      if (!shared || keys.length < 2) return { mode: "none", any, bySlot: {} };
      const other = keys.find((k) => k !== shared);
      const [a, b, x] = await Promise.all([bytesOf(members[shared][0]), bytesOf(members[shared][1]), bytesOf(bySlot[other])]);
      if (a !== b) return { mode: "none", any, bySlot: {} };
      if (a === x) return { mode: "one", any, bySlot: {} };
      return { mode: "rule", any, bySlot };
    })().catch(() => ({ mode: "none", any: null, bySlot: {} }));
    return pending;
  }
  async function defaultFace(name, gender) {
    const lib = await load();
    if (lib.mode === "one" && lib.any) return url(lib.any);
    if (lib.mode === "rule") {
      const id = lib.bySlot[slot(name, gender)];
      if (id) return url(id);
    }
    return SILHOUETTE;
  }
  const DEFAULT_SILHOUETTE = SILHOUETTE;
  const performerCreateHook = stashService().usePerformerCreate;
  const tagCreateHook = stashService().useTagCreate;
  const toastHook = pluginApi() && pluginApi().hooks && pluginApi().hooks.useToast;
  const routerLib$1 = pluginApi() && pluginApi().libraries && pluginApi().libraries.ReactRouterDOM;
  const historyHook$1 = routerLib$1 && routerLib$1.useHistory;
  const PromptC = routerLib$1 && routerLib$1.Prompt;
  function rawMutate(doc) {
    return async ({ variables }) => {
      const c = apolloClient();
      const m = stashDocument(doc);
      if (!c || !c.mutate || !m) throw new Error("Stash's data client is not available on this page.");
      return await c.mutate({ mutation: m, variables });
    };
  }
  const rawCreate = rawMutate("PerformerCreateDocument");
  const rawTagCreate = rawMutate("TagCreateDocument");
  function useCreateMutation() {
    if (performerCreateHook) return performerCreateHook()[0];
    return rawCreate;
  }
  function useTagMutation() {
    if (tagCreateHook) return tagCreateHook()[0];
    return rawTagCreate;
  }
  function useToastSafe() {
    if (toastHook) return toastHook();
    return { success: () => void 0, error: () => void 0 };
  }
  function useHistorySafe$1() {
    if (historyHook$1) return historyHook$1();
    return { push: (to) => window.location.href = to };
  }
  function messageOf(e) {
    const m = e.message;
    return String(m || e || "unknown error").replace(/^GraphQL error: /, "");
  }
  function useNarrow() {
    const q = "(max-width: 768px)";
    const [n, setN] = useState(() => !!(window.matchMedia && window.matchMedia(q).matches));
    useEffect(() => {
      if (!window.matchMedia) return void 0;
      const mq = window.matchMedia(q);
      const on = () => setN(mq.matches);
      if (mq.addEventListener) mq.addEventListener("change", on);
      else mq.addListener(on);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener("change", on);
        else mq.removeListener(on);
      };
    }, []);
    return n;
  }
  function useSettled(value, ms) {
    const [v, setV] = useState(value);
    useEffect(() => {
      const t = window.setTimeout(() => setV(value), ms);
      return () => window.clearTimeout(t);
    }, [value, ms]);
    return v;
  }
  function recordKey(src, rec, index) {
    const id = rec.remote_site_id || rec.urls && rec.urls[0] || (rec.name || "") + "#" + (index === null ? "" : index);
    return sourceKey(src) + "|" + id;
  }
  function handKey(name) {
    return "hand|" + name.trim().toLowerCase();
  }
  function changedFrom(b, draftJson, image, frames) {
    if (!b) return false;
    return draftJson !== b.draft || image !== b.image || frames !== b.frames;
  }
  function dropMessage(kept) {
    const who = kept.draft.name.trim() || "this performer";
    return kept.picked ? "Drop your changes to " + who + '? They are not saved anywhere. Cancel keeps them, and "Go back to them" under the search field returns to them.' : "Drop what you filled in for " + who + '? It is not saved anywhere. Cancel keeps it, and "Go back to it" under the search field returns to it.';
  }
  function handBackMessage(kept) {
    const who = kept.draft.name.trim() || "this performer";
    return kept.picked ? "Drop your changes to " + who + " and open Stash's form? They are not saved anywhere and do not go across. Cancel keeps them." : "Drop what you filled in for " + who + " and open Stash's form? It is not saved anywhere and does not go across. Cancel keeps it.";
  }
  function leaveMessage(name, byHand) {
    const who = name.trim() || "this performer";
    return byHand ? "Leave without adding " + who + "? What you filled in on this page is not saved anywhere." : "Leave without adding " + who + "? Your changes on this page are not saved anywhere.";
  }
  const CreatePage = ({ onUseStashForm }) => {
    const createPerformer = useCreateMutation();
    const createTagM = useTagMutation();
    const toast = useToastSafe();
    const history = useHistorySafe$1();
    const narrow = useNarrow();
    const initialQ = useMemo(() => {
      try {
        return new URLSearchParams(window.location.search).get("q") || "";
      } catch {
        return "";
      }
    }, []);
    const [boxes, setBoxes] = useState([]);
    const [scrapers, setScrapers] = useState([]);
    const [sourcesReady, setSourcesReady] = useState(false);
    const [sourcesError, setSourcesError] = useState(null);
    const [source, setSource] = useState(null);
    const [reloading, setReloading] = useState(false);
    const readSources = useCallback(async (fresh = false) => {
      try {
        const s = await loadSources(fresh);
        setBoxes(s.boxes);
        setScrapers(s.scrapers);
        setSource((cur) => {
          const all = s.boxes.concat(s.scrapers);
          const same = cur ? all.find((x) => sourceKey(x) === sourceKey(cur)) : null;
          return same || all[0] || null;
        });
        setSourcesError(null);
      } catch (e) {
        setSourcesError(messageOf(e));
      }
      setSourcesReady(true);
    }, []);
    useEffect(() => {
      readSources(false);
    }, [readSources]);
    const reloadScrapers$1 = useCallback(async () => {
      setReloading(true);
      try {
        await reloadScrapers();
        await readSources(true);
        toast.success("Reloaded scrapers");
      } catch (e) {
        toast.error(e);
      }
      setReloading(false);
    }, [readSources, toast]);
    const [query, setQuery] = useState(initialQ);
    const [search$1, setSearch] = useState({ status: "idle" });
    const [stageDupes, setStageDupes] = useState({ count: 0, list: [] });
    const seq2 = useRef(0);
    const timer = useRef(0);
    const runSearch = useCallback(
      async (q, src) => {
        const text = q.trim();
        seq2.current += 1;
        const mine = seq2.current;
        if (!text) {
          setSearch({ status: "idle" });
          setStageDupes({ count: 0, list: [] });
          return;
        }
        const link = looksLikeLink(text);
        const effective = link ? { kind: "link", name: "the link" } : src;
        if (!effective) {
          setSearch({ status: "idle" });
          findDupes(text).then((d) => {
            if (seq2.current === mine) setStageDupes(d);
          }).catch(() => void 0);
          return;
        }
        setSearch((prev) => ({
          status: "loading",
          q: text,
          results: prev.status === "idle" ? [] : prev.results,
          source: prev.status === "idle" ? effective : prev.source
        }));
        if (!link) {
          findDupes(text).then((d) => {
            if (seq2.current === mine) setStageDupes(d);
          }).catch(() => {
            if (seq2.current === mine) setStageDupes({ count: 0, list: [] });
          });
        } else {
          setStageDupes({ count: 0, list: [] });
        }
        try {
          const results = link ? await scrapeLink(text) : await search(effective, text);
          if (seq2.current !== mine) return;
          setSearch({ status: "done", q: text, results, source: effective });
        } catch (e) {
          if (seq2.current !== mine) return;
          setSearch((prev) => ({
            status: "error",
            q: text,
            results: [],
            source: effective,
            error: messageOf(e),
            ...prev.status === "idle" ? {} : {}
          }));
        }
      },
      []
    );
    const firstRun = useRef(true);
    useEffect(() => {
      if (!sourcesReady) return void 0;
      window.clearTimeout(timer.current);
      if (firstRun.current) {
        firstRun.current = false;
        runSearch(query, source);
        return void 0;
      }
      const text = query.trim();
      if (!text) {
        runSearch(query, source);
        return void 0;
      }
      const mine = seq2.current;
      timer.current = window.setTimeout(() => {
        if (looksLikeLink(text)) {
          setStageDupes({ count: 0, list: [] });
          return;
        }
        findDupes(text).then((d) => {
          if (seq2.current === mine) setStageDupes(d);
        }).catch(() => void 0);
      }, 500);
      return () => window.clearTimeout(timer.current);
    }, [query, sourcesReady]);
    const searchNow = useCallback(() => {
      window.clearTimeout(timer.current);
      runSearch(query, source);
    }, [query, source, runSearch]);
    const chooseSource = useCallback(
      (s) => {
        setSource(s);
        window.clearTimeout(timer.current);
        runSearch(query, s);
      },
      [query, runSearch]
    );
    const [phase, setPhase] = useState("stage");
    const [picked, setPicked] = useState(null);
    const [kept, setKept] = useState(null);
    const draftKey = useRef("");
    const [lastPicked, setLastPicked] = useState(null);
    const [reading, setReading] = useState(null);
    const [readError, setReadError] = useState(null);
    const [draft, setDraft] = useState(emptyDraft());
    const [unmatched, setUnmatched] = useState([]);
    const [frames, setFrames] = useState([]);
    const framesRef = useRef([]);
    framesRef.current = frames;
    const [chosen, setChosen] = useState(-1);
    const [broken, setBroken] = useState({});
    const [drawer, setDrawer] = useState(false);
    const [focusField, setFocusField] = useState(null);
    const [problems, setProblems] = useState({});
    const [customError, setCustomError] = useState(void 0);
    const [cardDupes, setCardDupes] = useState({ count: 0, list: [] });
    const [saving, setSaving] = useState({ status: "idle" });
    const top = useRef(null);
    const baseline = useRef(null);
    const leaving = useRef(false);
    const compose = useCallback((rec, src, index, name, field) => {
      draftKey.current = rec ? recordKey(src, rec, index) : handKey(name || "");
      setKept(null);
      if (rec) {
        const f = draftFromScraped(rec, src);
        setDraft(f.draft);
        setUnmatched(f.unmatchedTags);
        const imgs = (rec.images || []).filter(Boolean);
        setFrames(imgs.map((s) => ({ src: s, origin: "record" })));
        setChosen(imgs.length ? 0 : -1);
        setDrawer(false);
        baseline.current = { draft: JSON.stringify(f.draft), image: imgs.length ? imgs[0] : null, frames: imgs.length };
      } else {
        setDraft(emptyDraft(name || ""));
        setUnmatched([]);
        setFrames([]);
        setChosen(-1);
        setDrawer(true);
        setFocusField(field || "name");
        baseline.current = { draft: JSON.stringify(emptyDraft("")), image: null, frames: 0 };
      }
      setPicked(rec ? { rec, source: src, index } : null);
      setProblems({});
      setSaving({ status: "idle" });
      setBroken({});
      try {
        window.scrollTo(0, 0);
      } catch {
      }
      setPhase("composed");
      if (rec) {
        window.setTimeout(() => {
          if (top.current) top.current.focus({ preventScroll: true });
        }, 0);
      }
    }, []);
    const restore = useCallback((k) => {
      draftKey.current = k.key;
      setDraft(k.draft);
      setUnmatched(k.unmatched);
      setFrames(k.frames);
      setChosen(k.chosen);
      setBroken(k.broken);
      setPicked(k.picked);
      baseline.current = k.baseline;
      setKept(null);
      setProblems({});
      setSaving({ status: "idle" });
      setDrawer(false);
      try {
        window.scrollTo(0, 0);
      } catch {
      }
      setPhase("composed");
      window.setTimeout(() => {
        if (top.current) top.current.focus({ preventScroll: true });
      }, 0);
    }, []);
    const keptDirty = !!kept && (kept.picked ? changedFrom(kept.baseline, JSON.stringify(kept.draft), kept.chosen >= 0 && kept.frames[kept.chosen] ? kept.frames[kept.chosen].src : null, kept.frames.length) : JSON.stringify(kept.draft) !== JSON.stringify(emptyDraft(kept.draft.name)) || kept.frames.length > 0);
    const takeOver = useCallback(
      (key) => {
        if (!kept) return "go";
        if (kept.key === key) {
          restore(kept);
          return "restored";
        }
        if (keptDirty && !window.confirm(dropMessage(kept))) return "stop";
        return "go";
      },
      [kept, keptDirty, restore]
    );
    const pick = useCallback(
      async (i) => {
        if (search$1.status === "idle") return;
        const rec = search$1.results[i];
        const src = search$1.source;
        if (!rec) return;
        setLastPicked(i);
        setReadError(null);
        if (takeOver(recordKey(src, rec, i)) !== "go") return;
        if (src && src.kind === "scraper") {
          setReading(i);
          try {
            const full = await readRecord(src, rec);
            setReading(null);
            compose(full, src, i);
          } catch (e) {
            setReading(null);
            setReadError(messageOf(e));
          }
          return;
        }
        compose(rec, src, i);
      },
      [search$1, compose, takeOver]
    );
    const startByHand = useCallback(
      (field) => {
        const text = query.trim();
        const name = looksLikeLink(text) ? "" : text;
        const r = takeOver(handKey(name));
        if (r === "stop") return;
        if (r === "restored") {
          if (field) {
            setDrawer(true);
            setFocusField(field);
          }
          return;
        }
        compose(null, null, null, name, field);
        if (looksLikeLink(text)) setDraft((d) => ({ ...d, urls: [text] }));
      },
      [query, compose, takeOver]
    );
    const byHand = useCallback(() => startByHand(), [startByHand]);
    const differentPerson = useCallback(() => startByHand("disambiguation"), [startByHand]);
    const backToSearch = useCallback(() => {
      setKept({
        key: draftKey.current,
        picked,
        draft,
        unmatched,
        frames,
        chosen,
        broken,
        baseline: baseline.current
      });
      setPhase("stage");
      setDrawer(false);
      setSaving({ status: "idle" });
      window.setTimeout(() => {
        const el = document.getElementById("roc-q");
        if (el && lastPicked === null) el.focus();
        else {
          const hit = document.querySelector('.roc-pick[data-index="' + (lastPicked || 0) + '"]');
          if (hit) hit.focus();
          else if (el) el.focus();
        }
      }, 0);
    }, [lastPicked, picked, draft, unmatched, frames, chosen, broken]);
    const resumeKept = useCallback(() => {
      if (kept) restore(kept);
    }, [kept, restore]);
    const update = useCallback((k, v) => {
      setDraft((d) => ({ ...d, [k]: v }));
      setProblems((p) => {
        if (!p[k]) return p;
        const n = { ...p };
        delete n[k];
        return n;
      });
    }, []);
    const openField = useCallback((f) => {
      setDrawer(true);
      setFocusField(f);
    }, []);
    const closeDrawer = useCallback(() => setDrawer(false), []);
    const focused = useCallback(() => setFocusField(null), []);
    const createTag = useCallback(
      async (name) => {
        const r = await createTagM({ variables: { input: { name } } });
        const t = r && r.data && r.data.tagCreate;
        if (!t || !t.id) throw new Error("Stash did not confirm the new tag " + name + ".");
        setDraft((d) => ({ ...d, tags: d.tags.concat([{ id: String(t.id), name: t.name || name }]) }));
        setUnmatched((u) => u.filter((x) => x !== name));
      },
      [createTagM]
    );
    useEffect(() => {
      if (phase !== "composed") return void 0;
      const name = draft.name.trim();
      if (!name) {
        setCardDupes({ count: 0, list: [] });
        return void 0;
      }
      let live = true;
      const t = window.setTimeout(() => {
        findDupes(name).then((d) => {
          if (live) setCardDupes(d);
        }).catch(() => {
          if (live) setCardDupes({ count: 0, list: [] });
        });
      }, 350);
      return () => {
        live = false;
        window.clearTimeout(t);
      };
    }, [phase, draft.name]);
    useEffect(() => {
      if (phase !== "composed") return void 0;
      const onPaste = (e) => {
        const files = e.clipboardData && e.clipboardData.files;
        if (!files || !files.length) return;
        const file = Array.prototype.find.call(files, (f) => /^image\//.test(f.type));
        if (!file) return;
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
        e.stopPropagation();
        e.preventDefault();
        fileToDataURL(file).then((data) => {
          const n = framesRef.current.length;
          setFrames((fr) => fr.concat([{ src: data, origin: "file" }]));
          setChosen(n);
        });
      };
      window.addEventListener("paste", onPaste, true);
      return () => window.removeEventListener("paste", onPaste, true);
    }, [phase]);
    const addFrame = useCallback((f) => {
      const n = framesRef.current.length;
      setFrames((fr) => fr.concat([f]));
      setChosen(n);
    }, []);
    const imageSrc = chosen >= 0 && frames[chosen] ? frames[chosen].src : null;
    const draftJson = useMemo(() => JSON.stringify(draft), [draft]);
    const byHandDraft = phase === "composed" && !picked;
    const dirty = phase === "composed" ? changedFrom(baseline.current, draftJson, imageSrc, frames.length) : keptDirty;
    const leaveText = phase === "composed" ? leaveMessage(draft.name, byHandDraft) : kept ? leaveMessage(kept.draft.name, !kept.picked) : "";
    useEffect(() => {
      if (!dirty) return void 0;
      const onBeforeUnload = (e) => {
        if (leaving.current) return void 0;
        e.preventDefault();
        e.returnValue = leaveText;
        return leaveText;
      };
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty, leaveText]);
    const promptMessage = useCallback(
      (loc) => {
        if (leaving.current) return true;
        if (/\/performers\/new\/?$/.test(loc.pathname || "")) return true;
        return leaveText;
      },
      [leaveText]
    );
    const prompt = PromptC ? /* @__PURE__ */ R.createElement(PromptC, { when: dirty, message: promptMessage }) : null;
    const useStashForm = useCallback(() => {
      if (phase === "stage" && kept && keptDirty && !window.confirm(handBackMessage(kept))) return;
      const typed = query.trim();
      const name = phase === "composed" ? draft.name.trim() : looksLikeLink(typed) ? "" : typed;
      leaving.current = true;
      onUseStashForm(name);
    }, [phase, draft.name, query, onUseStashForm, kept, keptDirty]);
    const add = useCallback(
      async () => {
        const p = validate(draft);
        if (customError) {
          setDrawer(true);
          setFocusField("custom_fields");
          return;
        }
        if (Object.keys(p).length) {
          setProblems(p);
          const first = FIELD_ORDER.find((k) => p[k]);
          setDrawer(true);
          setFocusField(first || "name");
          return;
        }
        setSaving({ status: "saving" });
        const input = toCreateInput(draft, imageSrc);
        try {
          const r = await createPerformer({ variables: { input } });
          const made = r && r.data && r.data.performerCreate;
          if (!made || !made.id) {
            setSaving({ status: "error", error: "Stash did not confirm the new performer, so nothing was added. Try again." });
            return;
          }
          toast.success("Added " + draft.name.trim() + " to your library");
          baseline.current = null;
          setKept(null);
          leaving.current = true;
          history.push("/performers/" + made.id);
        } catch (e) {
          const msg = messageOf(e);
          setSaving({ status: "error", error: msg });
        }
      },
      [draft, imageSrc, createPerformer, toast, history, customError]
    );
    const openPerformer = useCallback((id) => history.push("/performers/" + id), [history]);
    if (phase === "stage") {
      return /* @__PURE__ */ R.createElement("div", { className: "roc-page" }, prompt, /* @__PURE__ */ R.createElement(
        Stage,
        {
          query,
          setQuery,
          searchNow,
          search: search$1,
          source,
          boxes,
          scrapers,
          sourcesError,
          sourcesReady,
          chooseSource,
          reloadScrapers: reloadScrapers$1,
          reloading,
          dupes: stageDupes,
          pick,
          reading,
          readError,
          lastPicked,
          byHand,
          differentPerson,
          kept: keptDirty && kept ? { name: kept.draft.name.trim(), byHand: !kept.picked } : null,
          resumeKept,
          useStashForm,
          typedName: looksLikeLink(query.trim()) ? "" : query.trim(),
          openPerformer,
          narrow
        }
      ));
    }
    return /* @__PURE__ */ R.createElement(R.Fragment, null, prompt, /* @__PURE__ */ R.createElement(
      Composed,
      {
        draft,
        picked,
        frames,
        chosen,
        setChosen,
        addFrame,
        broken,
        markBroken: (s) => setBroken((b) => b[s] ? b : { ...b, [s]: true }),
        imageSrc,
        drawer,
        closeDrawer,
        boxes,
        unmatched,
        openField,
        update,
        problems,
        createTag,
        focusField,
        focused,
        customError,
        setCustomError,
        dupes: cardDupes,
        openPerformer,
        saving,
        add,
        backToSearch,
        useStashForm,
        narrow,
        topRef: top
      }
    ));
  };
  function useDefaultFace(name, gender, on) {
    const [src, setSrc] = useState(DEFAULT_SILHOUETTE);
    useEffect(() => {
      if (!on) return void 0;
      let live = true;
      defaultFace(name, gender).then((u) => {
        if (live) setSrc(u);
      });
      return () => {
        live = false;
      };
    }, [name, gender, on]);
    return src;
  }
  const Composed = (p) => {
    const settledDraft = useSettled(p.draft, 250);
    const cardImage = p.imageSrc && !p.broken[p.imageSrc] ? p.imageSrc : null;
    const stock = useDefaultFace(settledDraft.name.trim(), settledDraft.gender || null, !cardImage);
    const perf = cardPerformer(settledDraft, cardImage || stock, "new");
    const strip = statStrip(settledDraft);
    const cardKey = [
      perf.name,
      perf.disambiguation,
      perf.gender,
      perf.country,
      perf.birthdate,
      perf.death_date,
      perf.tags.length,
      strip,
      cardImage ? cardImage.slice(0, 120) + cardImage.length : stock.slice(0, 120)
    ].join("|");
    const sourceName = p.picked && p.picked.source ? p.picked.source.name : "";
    const savingNow = p.saving.status === "saving";
    const name = p.draft.name.trim() || "this performer";
    const actions = (where) => /* @__PURE__ */ R.createElement("div", { className: "roc-actions is-" + where }, p.saving.status === "error" ? /* @__PURE__ */ R.createElement("p", { className: "roc-save-err", role: "alert" }, p.saving.error) : null, /* @__PURE__ */ R.createElement("div", { className: "roc-actions-row" }, /* @__PURE__ */ R.createElement(
      "button",
      {
        type: "button",
        className: "roc-btn is-primary is-big roc-add-btn",
        onClick: () => {
          if (!savingNow) p.add();
        },
        "aria-disabled": savingNow
      },
      savingNow ? "Adding " + name : "Add to library"
    )));
    const stageRef = p.topRef;
    return /* @__PURE__ */ R.createElement("div", { className: "roc-page roc-composed" + (savingNow ? " is-saving" : "") + (p.drawer ? " has-drawer" : "") }, /* @__PURE__ */ R.createElement(Ambient, { src: cardImage }), /* @__PURE__ */ R.createElement("div", { className: "roc-mint", ref: stageRef, tabIndex: -1, "aria-label": "New performer: " + name }, /* @__PURE__ */ R.createElement("p", { className: "roc-mint-top" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-link is-quiet roc-back-to", onClick: p.backToSearch, disabled: savingNow }, /* @__PURE__ */ R.createElement("span", { "aria-hidden": "true", className: "roc-back-glyph" }), "Back to search")), /* @__PURE__ */ R.createElement(
      LibraryPlate,
      {
        name: p.draft.name,
        disambiguation: p.draft.disambiguation,
        list: p.dupes.list,
        count: p.dupes.count,
        open: p.openPerformer,
        onDifferent: () => p.openField("disambiguation")
      }
    ), /* @__PURE__ */ R.createElement("div", { className: "roc-pair" }, /* @__PURE__ */ R.createElement("div", { className: "roc-card-stage" }, /* @__PURE__ */ R.createElement(LiveCard, { performer: perf, width: p.narrow ? 250 : 340, cardKey, strip }), savingNow ? /* @__PURE__ */ R.createElement("div", { className: "roc-card-saving", role: "status" }, "Adding ", name) : null), /* @__PURE__ */ R.createElement("section", { className: "roc-back", "aria-label": "The record" }, /* @__PURE__ */ R.createElement(Readouts, { draft: p.draft, boxes: p.boxes, unmatched: p.unmatched, open: p.openField }), /* @__PURE__ */ R.createElement("p", { className: "roc-correct" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-link", onClick: () => p.openField("name") }, "Correct something"), /* @__PURE__ */ R.createElement("span", { className: "roc-muted" }, "Any line opens the form at that field.")), p.drawer ? null : actions("stage"))), /* @__PURE__ */ R.createElement(
      Faces,
      {
        frames: p.frames,
        chosen: p.chosen,
        choose: p.setChosen,
        add: p.addFrame,
        sourceName: sourceName || "the record",
        broken: p.broken,
        markBroken: p.markBroken,
        narrow: p.narrow
      }
    ), /* @__PURE__ */ R.createElement("p", { className: "roc-handback" }, /* @__PURE__ */ R.createElement("button", { type: "button", className: "roc-link is-quiet", onClick: p.useStashForm }, p.draft.name.trim() ? "Use Stash's form with the name only" : "Use Stash's form instead"), /* @__PURE__ */ R.createElement("span", { className: "roc-muted" }, p.draft.name.trim() ? " (everything else here is left behind)" : " (it starts empty; nothing here is carried over)"))), /* @__PURE__ */ R.createElement(
      Drawer,
      {
        open: p.drawer,
        onClose: p.closeDrawer,
        title: p.picked ? "Correct " + name : "Fill in " + name,
        note: "Changes show on the card as you type.",
        stage: stageRef,
        fallback: ".roc-correct .roc-link",
        foot: actions("drawer")
      },
      /* @__PURE__ */ R.createElement(
        DetailsForm,
        {
          draft: p.draft,
          update: p.update,
          problems: p.problems,
          boxes: p.boxes,
          unmatched: p.unmatched,
          unmatchedSource: sourceName || "the record",
          createTag: p.createTag,
          focusField: p.focusField,
          focused: p.focused,
          customError: p.customError,
          setCustomError: p.setCustomError
        }
      )
    ));
  };
  const CREATE_PATH = /\/performers\/new\/?$/;
  function onCreateRoute() {
    try {
      return CREATE_PATH.test(window.location.pathname);
    } catch {
      return false;
    }
  }
  let owner = 0;
  let seq = 0;
  const subscribers = /* @__PURE__ */ new Set();
  function notify() {
    subscribers.forEach((f) => {
      try {
        f();
      } catch {
      }
    });
  }
  function useClaim() {
    const id = useRef(0);
    if (!id.current) {
      seq += 1;
      id.current = seq;
    }
    const [, bump] = useState(0);
    useEffect(() => {
      const me = id.current;
      const sub = () => bump((n) => n + 1);
      subscribers.add(sub);
      return () => {
        subscribers.delete(sub);
        if (owner === me) {
          owner = 0;
          notify();
        }
      };
    }, []);
    useEffect(() => {
      if (owner === 0) {
        owner = id.current;
        notify();
      }
    });
    return owner === id.current;
  }
  const MARK = "refractStashForm";
  const routerLib = pluginApi() && pluginApi().libraries && pluginApi().libraries.ReactRouterDOM;
  const historyHook = routerLib && routerLib.useHistory;
  function useHistorySafe() {
    if (historyHook) return historyHook();
    return null;
  }
  function entryMarked() {
    try {
      const st = window.history.state;
      return !!(st && st.state && st.state[MARK]);
    } catch {
      return false;
    }
  }
  function clearMark() {
    try {
      const st = window.history.state;
      if (!st || !st.state || !st.state[MARK]) return;
      const next = { ...st.state };
      delete next[MARK];
      window.history.replaceState({ ...st, state: Object.keys(next).length ? next : void 0 }, "");
    } catch {
    }
  }
  async function returnToOwned(history) {
    if (!history) {
      clearMark();
      return true;
    }
    const path = history.location ? history.location.pathname : window.location.pathname;
    let name = "";
    try {
      name = new URLSearchParams(window.location.search).get("q") || "";
    } catch {
    }
    const before = window.location.search;
    history.replace({ pathname: path, search: name ? "" : "?q=%20", state: { [MARK]: true } });
    if (window.location.search === before) return false;
    await new Promise((r) => window.setTimeout(r, 80));
    history.replace({ pathname: path, search: name ? "?q=" + encodeURIComponent(name) : "" });
    return true;
  }
  let handedBack = onCreateRoute() && entryMarked();
  const handSubs = /* @__PURE__ */ new Set();
  function setHandedBack(v) {
    handedBack = v;
    handSubs.forEach((f) => f());
  }
  function useHandedBack() {
    const [v, setV] = useState(handedBack);
    useEffect(() => {
      const f = () => setV(handedBack);
      handSubs.add(f);
      return () => {
        handSubs.delete(f);
      };
    }, []);
    return [v, setHandedBack];
  }
  function watchRoute() {
    const api = pluginApi();
    const ev = api && api.Event;
    if (!ev || typeof ev.addEventListener !== "function") return;
    try {
      ev.addEventListener("stash:location", () => {
        const want = onCreateRoute() && entryMarked();
        if (want !== handedBack) setHandedBack(want);
      });
    } catch {
    }
  }
  const HOST_CLASS = "refract-oc-host";
  const OWNED_BODY_CLASS = "refract-owned-create";
  function pageRoot() {
    try {
      return document.querySelector("#performer-page.new-view");
    } catch {
      return null;
    }
  }
  function focusStashForm() {
    let tries = 0;
    const look = () => {
      tries += 1;
      const root = pageRoot();
      const pick = (sel) => {
        if (!root) return null;
        const all = root.querySelectorAll(sel);
        for (let i = 0; i < all.length; i++) {
          const el2 = all[i];
          if (el2.closest("." + HOST_CLASS)) continue;
          const r = el2.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return el2;
        }
        return null;
      };
      const el = pick('input[name="name"]') || pick("form input:not([type=hidden]), form select, form textarea");
      if (el) {
        try {
          el.focus({ preventScroll: true });
        } catch {
        }
        return;
      }
      if (tries < 20) window.setTimeout(look, 50);
    };
    window.setTimeout(look, 0);
  }
  function usePortalContainer(active) {
    const [node, setNode] = useState(null);
    useEffect(() => {
      if (!active) return void 0;
      const root = pageRoot();
      if (!root) {
        warnOnce("no #performer-page.new-view to mount into; Stash's form stays");
        return void 0;
      }
      const el = document.createElement("div");
      el.className = HOST_CLASS;
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
        document.body.classList.add(cls);
      } catch {
      }
      return () => {
        try {
          document.body.classList.remove(cls);
        } catch {
        }
      };
    }, [cls, on]);
  }
  const CreateHost = () => {
    const mine = useClaim();
    const container = usePortalContainer(mine);
    const [back, setBack] = useHandedBack();
    const history = useHistorySafe();
    const [tripped, setTripped] = useState(false);
    const owned = mine && !!container && !back && !tripped;
    useBodyClass(OWNED_BODY_CLASS, owned);
    useEffect(() => {
      if (!owned) return;
      announceOnce("create page mounted through ImageInput");
      clearCreateUnavailable();
    }, [owned]);
    if (!mine || !container || tripped) return null;
    if (back) {
      return D.createPortal(
        /* @__PURE__ */ R.createElement("div", { className: "roc-return" }, /* @__PURE__ */ R.createElement(
          "button",
          {
            type: "button",
            className: "roc-link",
            onClick: () => {
              returnToOwned(history).then((ok) => {
                if (ok) setBack(false);
              });
            }
          },
          /* @__PURE__ */ R.createElement("span", { "aria-hidden": "true", className: "roc-back-glyph" }),
          "Use Refract's create page"
        ), /* @__PURE__ */ R.createElement("span", { className: "roc-muted" }, "It starts from the name; nothing typed here is carried over.")),
        container
      );
    }
    return D.createPortal(
      /* @__PURE__ */ R.createElement(RefractErrorBoundary, { fallback: null, onTrip: () => setTripped(true) }, /* @__PURE__ */ R.createElement(
        CreatePage,
        {
          onUseStashForm: (name) => {
            setBack(true);
            if (history) {
              history.replace({
                pathname: history.location ? history.location.pathname : window.location.pathname,
                search: name ? "?q=" + encodeURIComponent(name) : "",
                state: { [MARK]: true }
              });
            }
            try {
              window.scrollTo(0, 0);
            } catch {
            }
            focusStashForm();
          }
        }
      )),
      container
    );
  };
  function register() {
    const api = pluginApi();
    if (!api || !api.patch || typeof api.patch.instead !== "function" || !api.React) {
      window.setTimeout(register, 100);
      return;
    }
    try {
      api.patch.instead("ImageInput", function(...args) {
        const next = args.pop();
        const out = next.apply(this, args);
        if (!onCreateRoute()) return out;
        const props = args[0] || {};
        if (!props.isEditing || typeof props.onImageURL !== "function") return out;
        if (!ownCreatePageEnabled()) return out;
        return R.createElement(
          R.Fragment,
          null,
          out,
          R.createElement(CreateHost, { key: "refract-create-host" })
        );
      });
    } catch (e) {
      warnOnce("could not patch ImageInput; Stash's create form stays", e);
    }
    watchRoute();
  }
  register();
  watchSideDoor();
  exports.HOST_CLASS = HOST_CLASS;
  exports.OWNED_BODY_CLASS = OWNED_BODY_CLASS;
  exports.onCreateRoute = onCreateRoute;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
