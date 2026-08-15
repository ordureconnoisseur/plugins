#!/usr/bin/env python3
"""Validate a generated index.yml before it is published.

Stash parses the index as a single document: one malformed entry takes down
every plugin in the source, so this runs in CI and fails the build rather than
letting a broken index reach the CDN.

Usage: python3 validate_index.py _site/main/index.yml
"""

import os
import sys

import yaml

REQUIRED = ("id", "name", "version", "date", "path", "sha256")


def main(path):
    with open(path, encoding="utf-8") as fh:
        try:
            index = yaml.safe_load(fh)
        except yaml.YAMLError as err:
            return ["index.yml is not valid YAML: %s" % err]

    errors = []
    if not isinstance(index, list) or not index:
        return ["index.yml must be a non-empty list of packages"]

    site_dir = os.path.dirname(os.path.abspath(path))
    seen = {}

    for pos, entry in enumerate(index):
        if not isinstance(entry, dict):
            errors.append("entry %d is not a mapping" % pos)
            continue

        where = entry.get("id") or "entry %d" % pos

        for key in REQUIRED:
            if not entry.get(key):
                errors.append("%s: missing %s" % (where, key))

        description = (entry.get("metadata") or {}).get("description")
        if not description:
            errors.append("%s: missing metadata.description" % where)

        if entry.get("id") in seen:
            errors.append("%s: duplicate id" % where)
        seen[entry.get("id")] = True

        zip_path = entry.get("path")
        if zip_path and not os.path.isfile(os.path.join(site_dir, zip_path)):
            errors.append("%s: %s is missing from the site" % (where, zip_path))

    if not errors:
        print("index.yml OK - %d plugins: %s" % (len(index), ", ".join(sorted(seen))))
    return errors


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: validate_index.py <index.yml>")
    problems = main(sys.argv[1])
    for problem in problems:
        print("ERROR: %s" % problem, file=sys.stderr)
    sys.exit(1 if problems else 0)
