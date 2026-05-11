# Based on stashapp-plugin-advanced-scene-ratings by shackofnoreturn
# Original: https://github.com/shackofnoreturn/stashapp-plugin-advanced-scene-ratings
# License: AGPL v3 - https://www.gnu.org/licenses/agpl-3.0.html

import sys
import re
import json

try:
    import stashapi.log as log
    from stashapi.stashapp import StashInterface
except ModuleNotFoundError:
    import subprocess, importlib, site
    _installed = False
    for flags in [[], ["--break-system-packages"], ["--user"]]:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "stashapp-tools", "--quiet", "--timeout", "5"] + flags)
            _installed = True
            break
        except subprocess.CalledProcessError:
            continue
    if _installed:
        importlib.invalidate_caches()
        user_site = site.getusersitepackages()
        if user_site not in sys.path:
            sys.path.insert(0, user_site)
    else:
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "vendor"))
    import stashapi.log as log
    from stashapi.stashapp import StashInterface

PLUGIN_ID = "advancedSceneRating"

# TAGS — scenes use a plain prefix (no star suffix) to keep tag names readable
# and preserve compatibility with the pre-v2.3 tag schema users already have.
TAG_PATTERN = re.compile(r"^(.+?)\s*:\s*([0-5])$")
TAG_SUFFIX = ""
SVG_TAG_IMG = (
    "data:image/svg+xml;base64,PCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIi"
    "AiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj4KDTwhLS0gVXBsb2FkZW"
    "QgdG86IFNWRyBSZXBvLCB3d3cuc3ZncmVwby5jb20sIFRyYW5zZm9ybWVkIGJ5OiBTVkcgUmVwbyBNaXhlciBUb2"
    "9scyAtLT4KPHN2ZyB3aWR0aD0iODAwcHgiIGhlaWdodD0iODAwcHgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD"
    "0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KDTxnIGlkPSJTVkdSZXBvX2JnQ2Fycm"
    "llciIgc3Ryb2tlLXdpZHRoPSIwIi8+Cg08ZyBpZD0iU1ZHUmVwb190cmFjZXJDYXJyaWVyIiBzdHJva2UtbGluZW"
    "NhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KDTxnIGlkPSJTVkdSZXBvX2ljb25DYXJyaWVyIj"
    "4gPHBhdGggZD0iTTUuNjM2MDUgNS42MzYwNUwxOC4zNjQgMTguMzY0TTUuNjM2MDUgMTguMzY0TDE4LjM2NCA1Lj"
    "YzNjA1TTIxIDEyQzIxIDE2Ljk3MDYgMTYuOTcwNiAyMSAxMiAyMUM3LjAyOTQ0IDIxIDMgMTYuOTcwNiAzIDEyQz"
    "MgNy4wMjk0NCA3LjAyOTQ0IDMgMTIgM0MxNi45NzA2IDMgMjEgNy4wMjk0NCAyMSAxMloiIHN0cm9rZT0iI2ZmZm"
    "ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPiA8L2c+Cg08L3N2Zz4="
)
TAG_RATING_PARENT = {
    "name": "Advanced Rating System",
    "sort_name": "#Advanced Rating System",
    "description": "Advanced Rating System",
    "auto_ignore_tag": True,
    "image": SVG_TAG_IMG,
}

# A single default group keeps the legacy "flat weighted average" behavior.
# Users can add groups via the settings panel to bucket criteria.
DEFAULT_GROUPS = [
    {"id": "overall", "name": "Overall", "weight": 1.0},
]

DEFAULT_CRITERIA = [
    {"id": "production_quality", "name": "Production Quality", "group": "overall", "weight": 1.0, "enabled": True, "legacy_key": "disable_production_quality"},
    {"id": "chemistry",          "name": "Chemistry",          "group": "overall", "weight": 1.0, "enabled": True, "legacy_key": "disable_chemistry"},
    {"id": "performance",        "name": "Performance",        "group": "overall", "weight": 1.0, "enabled": True, "legacy_key": "disable_performance"},
    {"id": "aesthetics",         "name": "Aesthetics",         "group": "overall", "weight": 1.0, "enabled": True, "legacy_key": "disable_aesthetics"},
    {"id": "creativity",         "name": "Creativity",         "group": "overall", "weight": 1.0, "enabled": True, "legacy_key": "disable_creativity"},
]

settings = {
    "allow_destructive_actions": False,
}

MINIMUM_REQUIRED_TAGS = 1
STAR_PRECISION_MAP = {"FULL": 20, "HALF": 10, "QUARTER": 5, "TENTH": 1}


def main():
    log.info("RUNNING ...")
    global json_input, stash, criteria, groups
    json_input = read_stdin_json()
    stash = connect_to_stash(json_input)
    config = load_plugin_config(stash)
    update_settings_from_config(config)
    groups = load_groups()
    criteria = load_criteria(groups)
    log.debug(f"GROUPS: {[(g['id'], g['name'], g['weight']) for g in groups]}")
    log.debug(f"CRITERIA: {[(c['id'], c['name'], c['group'], c['weight'], c['enabled']) for c in criteria]}")
    handle_actions(json_input, stash)
    handle_hooks(json_input, stash)


def read_stdin_json():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            raise ValueError("No input received from stdin")
        return json.loads(raw_input)
    except json.JSONDecodeError as e:
        log.error(f"READ STDIN JSON: {e}")
    except ValueError as e:
        log.error(f"READ STDIN JSON: {e}")
    return {}


def connect_to_stash(json_input):
    try:
        return StashInterface(json_input["server_connection"])
    except KeyError:
        log.error("STASH INTERFACE: Missing 'server_connection' in input.")
    except Exception as e:
        log.error(f"STASH INTERFACE: Failed to connect: {e}")
    return None


def load_plugin_config(stash):
    try:
        return stash.get_configuration().get("plugins", {})
    except Exception as e:
        log.error(f"PLUGIN CONFIGURATION: Failed to load: {e}")
        return {}


def update_settings_from_config(config):
    try:
        if PLUGIN_ID in config:
            settings.update(config[PLUGIN_ID])
    except Exception as e:
        log.error(f"PLUGIN CONFIGURATION: Failed to update settings: {e}")


def _coerce_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    if isinstance(value, (int, float)):
        return value != 0
    return default


def _coerce_float(value, default=1.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def load_groups():
    raw_ids = settings.get("apr_group_ids")
    if not raw_ids or not isinstance(raw_ids, str):
        return [dict(g) for g in DEFAULT_GROUPS]
    ids = [s.strip() for s in raw_ids.split(",") if s.strip()]
    result = []
    for gid in ids:
        default = next((d for d in DEFAULT_GROUPS if d["id"] == gid), None)
        name = settings.get(f"apr_group_name_{gid}") or (default["name"] if default else gid.title())
        weight = _coerce_float(settings.get(f"apr_group_weight_{gid}"), default["weight"] if default else 1.0)
        result.append({"id": gid, "name": name, "weight": weight})
    return result or [dict(g) for g in DEFAULT_GROUPS]


def load_criteria(groups):
    valid_group_ids = {g["id"] for g in groups}
    fallback_group = groups[0]["id"] if groups else "overall"
    raw_ids = settings.get("apr_criteria_ids")
    if not raw_ids or not isinstance(raw_ids, str):
        return _criteria_from_legacy_defaults(valid_group_ids, fallback_group)

    ids = [s.strip() for s in raw_ids.split(",") if s.strip()]
    result = []
    for cid in ids:
        default = next((d for d in DEFAULT_CRITERIA if d["id"] == cid), None)
        name = settings.get(f"apr_name_{cid}") or (default["name"] if default else cid.title())
        group = settings.get(f"apr_group_{cid}") or (default["group"] if default else fallback_group)
        if group not in valid_group_ids:
            group = fallback_group
        weight = _coerce_float(settings.get(f"apr_weight_{cid}"), default["weight"] if default else 1.0)
        enabled = _coerce_bool(settings.get(f"apr_enabled_{cid}"), default["enabled"] if default else True)
        result.append({"id": cid, "name": name, "group": group, "weight": weight, "enabled": enabled})
    return result


def _criteria_from_legacy_defaults(valid_group_ids, fallback_group):
    out = []
    for d in DEFAULT_CRITERIA:
        legacy_disabled = _coerce_bool(settings.get(d["legacy_key"]), False)
        group = d["group"] if d["group"] in valid_group_ids else fallback_group
        out.append({
            "id": d["id"],
            "name": d["name"],
            "group": group,
            "weight": d["weight"],
            "enabled": d["enabled"] and not legacy_disabled,
        })
    return out


def tag_prefix(criterion):
    return f"{criterion['name']}{TAG_SUFFIX}"


def get_rating_precision():
    """STARS: FULL → 20, HALF → 10, QUARTER → 5, TENTH → 1 (defaults to FULL).
    DECIMAL: 1, since rating100 is stored in single-unit steps."""
    try:
        config = stash.get_configuration() or {}
        ui = config.get("ui") or {}
        rso = ui.get("ratingSystemOptions") or {}
        type_ = (rso.get("type") or "").upper()
        sp = (rso.get("starPrecision") or "").upper()
        if type_ == "DECIMAL":
            return 1
        return STAR_PRECISION_MAP.get(sp, 20)
    except Exception as e:
        log.warning(f"GET RATING PRECISION: Falling back to 20: {e}")
        return 20


def handle_actions(json_input, stash):
    args = json_input.get("args", {})
    mode = args.get("mode")
    if mode == "process_scenes":
        processScenes(stash)
    elif mode == "create_tags":
        createTags([c for c in criteria if c["enabled"]])
    elif mode == "remove_tags":
        removeTags(criteria)


def handle_hooks(json_input, stash):
    if not stash:
        log.error("HANDLE HOOKS: No stash connection.")
        return
    try:
        args = json_input.get("args", {})
        hook = args.get("hookContext", {})
        if hook.get("type") == "Scene.Update.Post":
            sceneID = hook.get("id") or hook.get("input", {}).get("id")
            if not sceneID:
                log.error("HANDLE HOOKS: Missing scene ID in hook context.")
                return
            scene = stash.find_scene(sceneID, fragment="id title rating100 tags { id name }")
            if scene:
                calculate_rating(stash, scene)
            else:
                log.error(f"HANDLE HOOKS: Scene {sceneID} not found.")
    except Exception as e:
        log.error(f"HANDLE HOOKS: Unexpected error: {e}")


def calculate_rating(stash, scene):
    enabled = [c for c in criteria if c["enabled"]]
    if not enabled:
        return
    by_prefix = {tag_prefix(c): c for c in enabled}
    hits_by_group = {g["id"]: [] for g in groups}
    tags = [tag["name"] for tag in (scene.get("tags") or [])]
    for tag in tags:
        match = TAG_PATTERN.match(tag)
        if not match:
            continue
        category, score = match.groups()
        category = category.strip()
        c = by_prefix.get(category)
        if not c:
            continue
        bucket = hits_by_group.get(c["group"])
        if bucket is None:
            continue
        bucket.append((int(score), float(c["weight"])))

    total_hits = sum(len(h) for h in hits_by_group.values())
    if total_hits < MINIMUM_REQUIRED_TAGS:
        return

    def weighted_avg(hits):
        tw = sum(w for _, w in hits)
        if tw <= 0:
            return None
        return sum(s * w for s, w in hits) / tw

    contributions = []
    for g in groups:
        gavg = weighted_avg(hits_by_group.get(g["id"], []))
        if gavg is None:
            continue
        gw = float(g.get("weight", 1.0))
        if gw <= 0:
            continue
        contributions.append((gavg, gw))
    if not contributions:
        return
    total_gw = sum(w for _, w in contributions)
    final_avg = sum(a * w for a, w in contributions) / total_gw

    precision = max(1, get_rating_precision())
    final_rating100 = round(round(final_avg * 20 / precision) * precision)
    final_rating100 = max(precision, min(100, final_rating100))
    current_rating = scene.get("rating100") or 0

    log.debug(f"CURRENT: {current_rating}/100, AVERAGE: {final_avg:.2f}/5, NEW: {final_rating100}/100")
    if current_rating != final_rating100:
        try:
            stash.update_scene({"id": scene["id"], "rating100": final_rating100})
            log.info(f"Updating Scene {scene.get('title', scene['id'])} rating to {final_rating100}/100")
        except Exception as e:
            log.error(f"CALCULATE RATING: Failed to update scene {scene.get('id', '?')}: {e}")


def processScenes(stash):
    log.info("PROCESSING ALL SCENES")
    try:
        scenes = stash.find_scenes({}, get_count=False, fragment="id title rating100 tags { id name }")
    except Exception as e:
        log.error(f"PROCESS SCENES: Failed to fetch scenes: {e}")
        return
    total = len(scenes)
    log.info(f"PROCESS SCENES: Found {total} scenes")
    for scene in scenes:
        try:
            calculate_rating(stash, scene)
        except Exception as e:
            log.error(f"PROCESS SCENES: Failed on scene {scene.get('id', '?')}: {e}")
    log.info(f"PROCESS SCENES: Done ({total} processed)")


def find_tag(name, create=False, parent_id=None):
    try:
        tag = stash.find_tag(name, create=False)
    except Exception as e:
        log.error(f"FIND TAG: Error searching for '{name}': {e}")
        return None
    if tag is None:
        if create:
            try:
                tag = stash.create_tag({"name": name})
                if tag:
                    update_data = {"id": tag["id"], "ignore_auto_tag": True}
                    if parent_id:
                        update_data["parent_ids"] = [parent_id]
                    stash.update_tag(update_data)
                else:
                    log.error(f"FIND TAG: Failed to create '{name}'")
            except Exception as e:
                log.error(f"FIND TAG: Error creating '{name}': {e}")
                tag = None
    return tag


def createTags(crits):
    log.info("CREATING TAGS ...")
    root_tag = find_tag(TAG_RATING_PARENT["name"], create=True)
    if not root_tag:
        log.error("CREATE TAGS: Failed to create or retrieve root tag.")
        return
    parent_id = root_tag["id"]
    for c in crits:
        prefix = tag_prefix(c)
        cat_tag = find_tag(prefix, create=True, parent_id=parent_id)
        if not cat_tag:
            log.error(f"CREATE TAGS: Failed to create '{prefix}', skipping.")
            continue
        cat_id = cat_tag["id"]
        for i in range(0, 6):
            num_tag_name = f"{prefix}: {i}"
            if not find_tag(num_tag_name, create=True, parent_id=cat_id):
                log.error(f"CREATE TAGS: Failed to create subtag '{num_tag_name}'")


def remove_tag(name):
    try:
        tag = stash.find_tag(name)
        if tag:
            stash.destroy_tag(tag["id"])
    except Exception as e:
        log.error(f"REMOVE TAG: Failed to remove '{name}': {e}")


def removeTags(crits):
    log.info("REMOVING TAGS ...")
    if not settings.get("allow_destructive_actions", False):
        log.warning("REMOVE TAGS: Destructive actions disabled.")
        return
    for c in crits:
        prefix = tag_prefix(c)
        for i in range(0, 6):
            remove_tag(f"{prefix}: {i}")
        remove_tag(prefix)
    remove_tag(TAG_RATING_PARENT["name"])


if __name__ == "__main__":
    main()
