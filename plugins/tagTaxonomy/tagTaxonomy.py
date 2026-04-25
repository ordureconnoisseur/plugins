import sys
import json
import base64

try:
    import stashapi.log as log
    from stashapi.stashapp import StashInterface
except ModuleNotFoundError:
    import subprocess, importlib, site, os
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

# ── Taxonomy ───────────────────────────────────────────────────────────────────

TAXONOMY = {
    "Acts": [
        "Blowjob", "Deepthroat", "Face Fuck", "Gagging", "Ball Sucking", "Ball Licking",
        "Oral Sex", "69",
        "Anal", "Anal Fingering", "Anal Creampie", "All Anal", "Anal Gape",
        "Anal Masturbation", "Anal Toys", "Butt Plug",
        "Vaginal Sex", "Pussy Licking", "Pussy Fingering", "Pussy Rubbing", "Fingering",
        "Cumshot", "Facial", "Creampie", "Cum in Mouth", "Cum Swallowing", "Cum on Tits",
        "Cum on Ass", "Cum on Pussy", "Open Mouth Facial", "Cum Swapping", "Mouth Creampie",
        "Pussy Creampie",
        "Titjob", "Tit Worship", "Breast Play", "Breast Holding",
        "Handjob",
        "Rimming", "Ass to Mouth", "Ass Worship", "Facesitting",
        "Masturbation", "Solo Female", "Self Anal Fingering",
        "Squirting", "Orgasm",
        "Scissoring",
        "Fisting",
        "Gangbang", "Group Sex", "Threesome", "Threesome (BGG)", "Foursome", "Orgy",
        "Spit Roast", "Bukkake", "Double Penetration",
        "Striptease", "Spanking",
        "Oil", "Massage", "Nuru Massage", "Kissing",
        "Cock Milking", "Milking Table",
        "Flashing", "Public Nudity", "Voyeur",
        "Twerking",
    ],
    "Positions": [
        "Doggy Style", "Standing Doggy Style", "Prone Bone",
        "Cowgirl", "Reverse Cowgirl", "Squatting Cowgirl",
        "Missionary", "Missionary - POV", "Missionary Blowjob",
        "Side Fuck", "Piledriver", "Spooning", "Stand and Carry", "Riding",
        "Blowjob - POV",
    ],
    "Body Type": [
        "Natural Tits", "Big Tits", "Small Tits", "Medium Tits", "Fake Tits", "Perky Tits",
        "Tiny Tits", "All Natural", "Puffy Nipples", "Big Areolas", "Bouncing Tits",
        "Big Ass", "Small Ass", "Medium Ass", "PAWG",
        "Big Dick", "BBC",
        "Hairless Pussy", "Hairy Pussy", "Trimmed Pussy", "Innie Pussy", "Outie Pussy",
        "Hairless Labia", "Hairless Genitals",
        "Athletic", "Athletic Woman", "Slim", "Curvy", "Tiny Woman", "Average Body",
        "Muscular Man", "Girl Cock",
    ],
    "Appearance": [
        "Blonde Hair", "Brown Hair (Female)", "Red Hair", "Black Hair",
        "Blonde Hair (Female)", "Short Hair", "Long Hair", "Straight Hair", "Pigtails",
        "Blue Eyes", "Brown Eyes", "Green Eyes",
        "Pale Skin", "Tanned Skin", "Medium Skin", "Tan Lines",
        "Freckles", "Tattoos", "Piercing", "Tattoos & Piercings", "Navel Piercing",
        "Nose Piercing",
    ],
    "Ethnicity": [
        "White", "White Woman", "Asian", "Asian Woman", "Latina Woman",
        "Black", "Black Man", "American", "Interracial", "Russian", "Argentinian", "Latin",
    ],
    "Setting": [
        "Indoors", "Outdoors",
        "Bedroom", "Living Room", "Kitchen", "Shower", "Couch", "Home",
        "College", "School", "Work Fantasies",
    ],
    "Style": [
        "Amateur", "Homemade", "Reality Porn", "Professional Production",
        "POV", "Lesbian", "Twosome (Straight)", "Twosome (Lesbian)",
        "Hardcore", "Softcore", "Exclusive", "Pornstar",
        "Interview", "Narrative", "3rd Person Narrative",
    ],
    "Clothing": [
        "Lingerie", "Thong", "G-string", "Stockings", "Garter Belt", "Panties", "Fishnet",
        "Pantyhose", "Bikini", "One-piece", "Dress", "Skirt", "Shorts", "Denim Shorts",
        "Leggings", "Socks", "Over-the-Knee Socks", "Sports Bra", "Glasses", "High Heels",
        "Uniform", "Corset", "Tank Top", "Bra",
    ],
    "Fetish": [
        "Scat", "Golden Shower", "Piss Drinking", "Piss Play", "Piss in Ass", "Pee",
        "Peeing", "Piss Swapping", "Fart", "Puke", "Vomit", "Prolapse", "Anal Winking",
        "Bondage", "BDSM", "Humiliation", "Rough", "Gaping", "Gape",
        "Freeuse", "Foot Fetish", "Footjob", "Armpit Fetish", "Spitting",
    ],
    "Roleplay": [
        "Family Roleplay", "Step Daughter", "Step Dad", "Cheating", "Wife", "Girlfriend",
        "Boyfriend", "Cosplay", "Schoolgirl",
    ],
    "Content Type": [
        "Reels", "4K Available", "Teen Girl (18-22)", "Teen (18-22)", "Young Woman (22-30)",
        "MILF",
    ],
}

# canonical tag → list of duplicate tags to absorb into it
MERGES = {
    "Blowjob":            ["Blow Job", "sucking dick", "dick sucking", "Deep Throating"],
    "Blowjob - POV":      ["pov blowjob"],
    "Doggy Style":        ["doggystyle"],
    "Handjob":            ["Hand Job"],
    "Titjob":             ["Tit Job", "Titty Fuck"],
    "Facesitting":        ["Face Sitting"],
    "Rimming":            ["Ass Licking"],
    "Brown Hair (Female)":["brunette"],
    "POV":                ["point of view", "Male POV"],
    "Scissoring":         ["Tribbing"],
    "Big Tits":           ["big boobs"],
    "Big Dick":           ["big cock"],
    "Twosome (Straight)": ["Couple Sex (Straight)", "Couple Sex"],
}

# ── Globals ────────────────────────────────────────────────────────────────────

stash = None
settings = {"min_categories": 1}

# ── Bootstrap ──────────────────────────────────────────────────────────────────

def main():
    global stash, settings
    raw = sys.stdin.read()
    json_input = json.loads(raw) if raw.strip() else {}

    stash = StashInterface(json_input["server_connection"])
    config = stash.get_configuration().get("plugins", {}).get("tagTaxonomy", {})
    settings.update(config)

    mode = (json_input.get("args", {}).get("mode") or
            (json_input.get("args", {}).get("hookContext") or {}).get("type", ""))

    if mode == "setup_taxonomy":
        setup_taxonomy()
    elif mode == "apply_tag_images":
        apply_tag_images()
    elif mode == "mark_organised":
        mark_organised()
    else:
        log.error(f"Unknown mode: {mode}")

# ── Task 1: Setup Taxonomy ─────────────────────────────────────────────────────

def setup_taxonomy():
    log.info("Setting up tag taxonomy...")

    # Build a name→id map of all existing tags for efficiency
    all_tags = stash.find_tags(f={}, filter={"per_page": -1})
    tag_map = {t["name"]: t["id"] for t in all_tags}

    # Step 1: merge duplicates first so canonical tags are clean
    log.info("Merging duplicate tags...")
    for canonical, dupes in MERGES.items():
        canonical_id = tag_map.get(canonical)
        if not canonical_id:
            log.warning(f"Canonical tag '{canonical}' not found, skipping merge")
            continue
        source_ids = [tag_map[d] for d in dupes if d in tag_map]
        if not source_ids:
            continue
        log.info(f"Merging {[d for d in dupes if d in tag_map]} → '{canonical}'")
        stash.merge_tags(source_ids, canonical_id)
        # Remove merged tags from map
        for d in dupes:
            tag_map.pop(d, None)

    # Refresh map after merges
    all_tags = stash.find_tags(f={}, filter={"per_page": -1})
    tag_map = {t["name"]: t["id"] for t in all_tags}

    # Step 2: create parent category tags if missing, then assign children
    log.info("Creating parent tags and assigning children...")
    for category, children in TAXONOMY.items():
        # Find or create the parent tag
        if category in tag_map:
            parent_id = tag_map[category]
            log.debug(f"Parent tag '{category}' already exists")
        else:
            result = stash.create_tag({"name": category})
            parent_id = result["id"]
            tag_map[category] = parent_id
            log.info(f"Created parent tag '{category}'")

        # Assign each child tag to this parent (only if it exists in the library)
        for child_name in children:
            child_id = tag_map.get(child_name)
            if not child_id:
                continue
            # Get current parents to avoid overwriting existing ones
            child_tag = stash.find_tag(child_name)
            existing_parents = [p["id"] for p in child_tag.get("parents", [])]
            if parent_id in existing_parents:
                continue
            stash.update_tag({
                "id": child_id,
                "parent_ids": list(set(existing_parents + [parent_id]))
            })
            log.debug(f"  '{child_name}' → '{category}'")

    log.info("Taxonomy setup complete.")

# ── Task 2: Apply Tag Images ───────────────────────────────────────────────────

def apply_tag_images():
    import requests
    log.info("Applying tag images...")

    base_url = stash._url

    for category in TAXONOMY:
        cat_tag = stash.find_tag(category)
        if not cat_tag:
            log.warning(f"Category tag '{category}' not found")
            continue

        # Skip if already has an image
        if cat_tag.get("image_path") and "default=true" not in (cat_tag.get("image_path") or ""):
            log.debug(f"'{category}' already has an image, skipping")
            continue

        # Find child tag IDs
        child_ids = []
        for name in TAXONOMY[category]:
            t = stash.find_tag(name)
            if t:
                child_ids.append(t["id"])
        if not child_ids:
            continue

        # Find one scene with any of these tags
        scenes = stash.find_scenes(
            f={"tags": {"value": child_ids, "modifier": "INCLUDES", "depth": 0}},
            filter={"per_page": 1}
        )
        if not scenes:
            log.debug(f"No scenes found for '{category}'")
            continue

        scene_id = scenes[0]["id"]
        screenshot_url = f"{base_url}/scene/{scene_id}/screenshot"

        try:
            resp = requests.get(screenshot_url, timeout=10)
            resp.raise_for_status()
            b64 = base64.b64encode(resp.content).decode("utf-8")
            mime = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
            image_data = f"data:{mime};base64,{b64}"
            stash.update_tag({"id": cat_tag["id"], "image": image_data})
            log.info(f"Set image for '{category}' from scene {scene_id}")
        except Exception as e:
            log.error(f"Failed to set image for '{category}': {e}")

    log.info("Tag images applied.")

# ── Task 3: Mark Organised ─────────────────────────────────────────────────────

def mark_organised():
    log.info("Marking organised scenes...")

    min_cats = int(settings.get("min_categories") or 1)

    # Build a tag_id → category map
    all_tags = stash.find_tags(f={}, filter={"per_page": -1})
    tag_map = {t["name"]: t["id"] for t in all_tags}

    tag_to_category = {}
    for category, children in TAXONOMY.items():
        for child in children:
            if child in tag_map:
                tag_to_category[tag_map[child]] = category

    # Process all unorganised scenes
    scenes = stash.find_scenes(
        f={"organized": False},
        filter={"per_page": -1}
    )
    log.info(f"Checking {len(scenes)} unorganised scenes...")

    marked = 0
    for scene in scenes:
        scene_tag_ids = {t["id"] for t in scene.get("tags", [])}
        categories_present = {tag_to_category[tid] for tid in scene_tag_ids if tid in tag_to_category}
        if len(categories_present) >= min_cats:
            stash.update_scene({"id": scene["id"], "organized": True})
            marked += 1

    log.info(f"Marked {marked} scenes as organised.")

if __name__ == "__main__":
    main()
