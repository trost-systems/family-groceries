#!/usr/bin/env python3
"""The built app carries the App Shortcuts Siri matches (job 97), not only the source tree.

Metadata.appintents/extract.actionsdata must list the App Shortcuts of HummlistShortcuts
(AddItemsIntent, ReadListIntent, OpenListIntent) with phrase templates that each name the app,
the negative phrases, and the item entity; the phrases and negative phrases must be localized for
de and en; Siri says "Hummlist", and no German alternative name ends in "Liste".

Usage: scripts/app-shortcuts-bundle.py [Runner.app | Hummlist.ipa]
"""
import json
import plistlib
import re
import sys
import tempfile
import zipfile
from pathlib import Path

SHORTCUTS = {"AddItemsIntent", "ReadListIntent", "OpenListIntent"}
ENTITY = "ItemSuggestion"
LANGUAGES = ("de", "en")
APP_NAME = "${applicationName}"


def check(app: Path) -> tuple[list[str], list[str]]:
    """What is missing, and what was found."""
    actions = app / "Metadata.appintents/extract.actionsdata"
    if not actions.is_file():
        return [f"{actions} is missing"], []
    data = json.loads(actions.read_text())
    found: list[str] = []
    shortcuts = {s.get("actionIdentifier"): s for s in data.get("autoShortcuts", [])}
    for missing in sorted(SHORTCUTS - shortcuts.keys()):
        found.append(f"{actions}: no App Shortcut for {missing}")
    for extra in sorted(shortcuts.keys() - SHORTCUTS):
        found.append(f"{actions}: unexpected App Shortcut {extra}")
    keys = []
    for name, shortcut in sorted(shortcuts.items()):
        templates = [t.get("key", "") for t in shortcut.get("phraseTemplates", [])]
        if not templates:
            found.append(f"{actions}: {name} has no phrases")
        found += [f'{actions}: {name} phrase "{t}" does not name the app' for t in templates if APP_NAME not in t]
        keys += templates
    for name in sorted(SHORTCUTS - data.get("actions", {}).keys()):
        found.append(f"{actions}: no action {name}")
    if ENTITY not in data.get("entities", {}):
        found.append(f"{actions}: no entity {ENTITY}")
    negatives = [n.get("phrase", {}).get("key", "") for n in data.get("negativePhrases", [])]
    if not negatives:
        found.append(f"{actions}: no negative phrases")
    found += localized(app, keys, negatives)
    found += spoken_names(app)
    return found, sorted(shortcuts)


def spoken_names(app: Path) -> list[str]:
    """Siri says "Hummlist", and no German alternative name ends in "Liste", Reminders' grammar
    (job 97)."""
    info_path = app / "Info.plist"
    if not info_path.is_file():
        return [f"{info_path} is missing"]
    info = plistlib.loads(info_path.read_bytes())
    variables = [e.get("INAlternativeAppName", "") for e in info.get("INAlternativeAppNames", [])]
    found = []
    for lang in ("Base", *LANGUAGES):
        path = app / f"{lang}.lproj/InfoPlist.strings"
        table = strings(path) if path.is_file() else {}
        spoken = table.get("CFBundleSpokenName", info.get("CFBundleSpokenName"))
        if spoken != "Hummlist":
            found.append(f'{lang}.lproj: CFBundleSpokenName is "{spoken}", not "Hummlist"')
        names = [table.get(v, v) for v in variables]
        found += [f'{lang}.lproj: alternative app name "{n}" is "Humm" alone' for n in names if n.lower() == "humm"]
        if lang == "de":
            found += [f'de.lproj: alternative app name "{n}" ends in Liste' for n in names if n.lower().endswith("liste")]
    return found


def strings(path: Path) -> dict:
    """A compiled .strings file: a binary or XML plist, or the text format in UTF-8 or UTF-16."""
    raw = path.read_bytes()
    try:
        return plistlib.loads(raw)
    except (plistlib.InvalidFileException, ValueError):
        text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8")
        pairs = re.findall(r'"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;', text)
        return {k.replace('\\"', '"'): v.replace('\\"', '"') for k, v in pairs}


def localized(app: Path, keys: list[str], negatives: list[str]) -> list[str]:
    """Each language's compiled AppShortcuts.strings holds a phrase set for every template and
    negative phrase: Xcode writes the catalog's string sets as "#!SET#!_<phrase>[<index>]" keys.
    A negative phrase never names the app."""
    found = []
    for lang in LANGUAGES:
        table = app / f"{lang}.lproj/AppShortcuts.strings"
        if not table.is_file():
            found.append(f"{app}/{lang}.lproj has no compiled AppShortcuts.strings")
            continue
        phrases = strings(table)
        for key in keys:
            values = [v for k, v in phrases.items() if k.startswith(f"#!SET#!_{key}[")]
            if not values:
                found.append(f'{lang}.lproj AppShortcuts: no phrases for "{key}"')
            found += [f'{lang}.lproj AppShortcuts: "{v}" does not name the app' for v in values if APP_NAME not in v]
            found += [
                f'{lang}.lproj AppShortcuts: "{v}" must keep {", ".join(parameters(key)) or "no parameter"}'
                for v in values
                if parameters(v) != parameters(key)
            ]
        for negative in negatives:
            values = [v for k, v in phrases.items() if k.startswith(f"#!SET#!_{negative}[")]
            if not values:
                found.append(f'{lang}.lproj AppShortcuts: no phrases for the negative "{negative}"')
            found += [
                f'{lang}.lproj AppShortcuts: negative "{v}" names the app'
                for v in values
                if APP_NAME in v or "hummlist" in v.lower()
            ]
    return found


def parameters(phrase: str) -> list[str]:
    return sorted(p for p in re.findall(r"\$\{\w+\}", phrase) if p != APP_NAME)


def main() -> int:
    target = Path(sys.argv[1])
    with tempfile.TemporaryDirectory() as tmp:
        if target.suffix == ".ipa":
            with zipfile.ZipFile(target) as ipa:
                ipa.extractall(tmp)
            apps = sorted(Path(tmp).glob("Payload/*.app"))
            if not apps:
                print(f"app-shortcuts-bundle: {target} has no Payload/*.app", file=sys.stderr)
                return 1
            target = apps[0]
        found, shortcuts = check(target)
    if found:
        print("\n".join(f"app-shortcuts-bundle: {p}" for p in found), file=sys.stderr)
        return 1
    print(f"app-shortcuts-bundle: {', '.join(shortcuts)} with phrases in {', '.join(LANGUAGES)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
