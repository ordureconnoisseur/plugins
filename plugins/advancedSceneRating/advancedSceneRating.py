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
        # pip unavailable — fall back to bundled vendor copy
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "vendor"))
    import stashapi.log as log
    from stashapi.stashapp import StashInterface

# TAGS
TAG_PATTERN = re.compile(r"^(.+?)\s*:\s*([0-5])$")
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
    "aliases": [],
    "auto_ignore_tag": True,
    "favorite": True,
    "image": SVG_TAG_IMG
}

ALL_CATEGORIES = ["Production Quality", "Chemistry", "Performance", "Aesthetics", "Creativity"]

DISABLE_KEYS = {
    "Production Quality": "disable_production_quality",
    "Chemistry":          "disable_chemistry",
    "Performance":        "disable_performance",
    "Aesthetics":         "disable_aesthetics",
    "Creativity":         "disable_creativity",
}

# GLOBALS
settings = {
    "minimum_required_tags": 5,
    "allow_destructive_actions": False
}


def main():
    log.info("RUNNING ...")
    global json_input, stash, categories, minimum_required_tags

    json_input = read_stdin_json()
    stash = connect_to_stash(json_input)
    config = load_plugin_config(stash)

    update_settings_from_config(config)
    categories = get_categories()
    minimum_required_tags = get_minimum_required_tags()
    get_allow_destructive_actions()

    handle_actions(json_input, stash, categories, minimum_required_tags)
    handle_hooks(json_input, stash)


def read_stdin_json():
    log.debug("READING INPUT ...")
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            raise ValueError("No input received from stdin")
        return json.loads(raw_input)
    except json.JSONDecodeError as e:
        log.error(f"READ STDIN JSON: Failed to decode JSON: {e}")
    except ValueError as e:
        log.error(f"READ STDIN JSON: {e}")
    return {}

def connect_to_stash(json_input):
    log.debug("CONNECTING STASH INTERFACE ...")
    try:
        server_connection = json_input["server_connection"]
        return StashInterface(server_connection)
    except KeyError:
        log.error("STASH INTERFACE: Missing 'server_connection' in input.")
    except Exception as e:
        log.error(f"STASH INTERFACE: Failed to connect: {e}")
    return None

def load_plugin_config(stash):
    log.debug("LOADING PLUGIN CONFIGURATION ...")
    try:
        return stash.get_configuration().get("plugins", {})
    except Exception as e:
        log.error(f"PLUGIN CONFIGURATION: Failed to load: {e}")
        return {}

def update_settings_from_config(config):
    log.debug("UPDATING SETTINGS WITH CONFIG ...")
    try:
        if "advancedSceneRating" in config:
            settings.update(config["advancedSceneRating"])
            log.debug(f"SETTINGS: {settings}")
    except Exception as e:
        log.error(f"PLUGIN CONFIGURATION: Failed to update settings: {e}")

def get_categories():
    log.debug("GET CATEGORIES ...")
    result = [c for c in ALL_CATEGORIES if not settings.get(DISABLE_KEYS[c], False)]
    log.debug(f"CATEGORIES: {result}")
    return result

def get_minimum_required_tags():
    log.debug("GET MINIMUM REQUIRED TAGS ...")
    try:
        mrt_raw = settings.get("minimum_required_tags")
        value = int(mrt_raw) if mrt_raw is not None else 5
        log.debug(f"MINIMUM REQUIRED TAGS: {value}")
        return value
    except Exception as e:
        log.error(f"PLUGIN CONFIGURATION: Failed to parse minimum_required_tags: {e}")
    return 5

def get_allow_destructive_actions():
    log.debug("GET ALLOW DESTRUCTIVE ACTIONS ...")
    try:
        global allow_destructive_actions
        allow_destructive_actions = settings.get("allow_destructive_actions", False)
        log.debug(f"ALLOW DESTRUCTIVE ACTIONS: {allow_destructive_actions}")
    except Exception as e:
        log.error(f"PLUGIN CONFIGURATION: Failed to read 'allow_destructive_actions': {e}")
        allow_destructive_actions = False

def handle_actions(json_input, stash, categories, minimum_required_tags):
    log.debug("HANDLING ACTIONS ...")
    args = json_input.get("args", {})
    mode = args.get("mode")
    if mode == "process_scenes":
        processScenes(stash, categories, minimum_required_tags)
    elif mode == "create_tags":
        createTags(categories)
    elif mode == "remove_tags":
        removeTags(ALL_CATEGORIES)

def handle_hooks(json_input, stash):
    log.debug("HANDLING HOOKS ...")
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
            log.debug(f"HANDLE HOOKS: Processing scene {sceneID}")
            scene = stash.find_scene(sceneID)
            if scene:
                processScene(scene)
            else:
                log.error(f"HANDLE HOOKS: Scene {sceneID} not found.")
    except Exception as e:
        log.error(f"HANDLE HOOKS: Unexpected error: {e}")

def calculate_rating(stash, scene, categories, minimum_required_tags):
    tags = [tag['name'] for tag in (scene.get('tags') or [])]
    scores = {}
    for tag in tags:
        match = TAG_PATTERN.match(tag)
        if match:
            category, score = match.groups()
            category = category.strip()
            if category in categories:
                scores[category] = int(score)

    log.debug(f"SCORES: {scores}")
    if len(scores) < minimum_required_tags:
        log.debug(f"CALCULATE RATING: Skipping scene {scene.get('id', '?')} — needs {minimum_required_tags} tag(s), got {len(scores)}")
        return

    average = sum(scores.values()) / len(scores)
    precision_raw = settings.get("rating_precision")
    precision = max(1, int(precision_raw)) if precision_raw else 10
    final_rating = round(round(average * 20 / precision) * precision)
    final_rating = max(precision, min(100, final_rating))
    current_rating = scene.get("rating100") or 0

    log.debug(f"CURRENT: {current_rating}/100, AVERAGE: {average:.2f}/5, NEW: {final_rating}/100")
    try:
        stash.update_scene({"id": scene["id"], "rating100": final_rating})
        log.info(f"Updating Scene {scene.get('title', scene['id'])} rating to {final_rating}/100")
    except Exception as e:
        log.error(f"CALCULATE RATING: Failed to update scene {scene.get('id', '?')}: {e}")


def processScene(scene):
    if scene:
        log.debug(f"PROCESSING SCENE: {scene['id']}")
        calculate_rating(stash, scene, categories, minimum_required_tags)
    else:
        log.debug("PROCESSING SCENE: SKIPPING (no scene data)")

def processScenes(stash, categories, minimum_required_tags):
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
            calculate_rating(stash, scene, categories, minimum_required_tags)
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
        log.debug(f"FIND TAG: '{name}' not found")
        if create:
            try:
                tag = stash.create_tag({"name": name})
                if tag:
                    update_data = {
                        "id": tag["id"],
                        "sort_name": f"#{name}",
                        "description": TAG_RATING_PARENT["description"],
                        "ignore_auto_tag": True,
                        "image": SVG_TAG_IMG,
                    }
                    if parent_id:
                        update_data["parent_ids"] = [parent_id]
                    stash.update_tag(update_data)
                    log.debug(f"FIND TAG: Created '{name}'")
                else:
                    log.error(f"FIND TAG: Failed to create '{name}'")
            except Exception as e:
                log.error(f"FIND TAG: Error creating '{name}': {e}")
                tag = None
    else:
        log.debug(f"FIND TAG: Found '{name}'")
    return tag

def createTags(categories):
    log.info("CREATING TAGS ...")
    root_tag = find_tag(TAG_RATING_PARENT["name"], create=True)
    if not root_tag:
        log.error("CREATE TAGS: Failed to create or retrieve root tag.")
        return
    parent_id = root_tag["id"]
    for cat in categories:
        cat_tag = find_tag(cat, create=True, parent_id=parent_id)
        if not cat_tag:
            log.error(f"CREATE TAGS: Failed to create tag for '{cat}', skipping.")
            continue
        cat_id = cat_tag["id"]
        for i in range(0, 6):
            num_tag_name = f"{cat}: {i}"
            if not find_tag(num_tag_name, create=True, parent_id=cat_id):
                log.error(f"CREATE TAGS: Failed to create subtag '{num_tag_name}'")

def remove_tag(name):
    try:
        tag = stash.find_tag(name)
        if tag:
            stash.destroy_tag(tag["id"])
            log.debug(f"REMOVE TAG: Removed '{name}'")
        else:
            log.debug(f"REMOVE TAG: '{name}' not found, skipping")
    except Exception as e:
        log.error(f"REMOVE TAG: Failed to remove '{name}': {e}")

def removeTags(categories):
    log.info("REMOVING TAGS ...")
    if not allow_destructive_actions:
        log.warning("REMOVE TAGS: Destructive actions disabled.")
        return
    for cat in categories:
        for i in range(0, 6):
            remove_tag(f"{cat}: {i}")
        remove_tag(cat)
    remove_tag(TAG_RATING_PARENT["name"])

if __name__ == "__main__":
    main()
