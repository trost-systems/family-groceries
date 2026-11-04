#!/usr/bin/env python3
"""Every SiriKit intent the app or an extension declares needs example phrases in each language.

App Store Connect flags a build whose INIntentsSupported (in-app handling), an extension's
NSExtensionAttributes IntentsSupported or an IN...Intent in NSUserActivityTypes has no
IntentExamples entry in the app's <lang>.lproj/AppIntentVocabulary.plist (ITMS-90626, build 1130).
Each example must name the app. The languages are de, en and every other .lproj but Base.

Usage: scripts/siri-vocabulary.py [app/ios | Runner.app | Hummlist.ipa]
The source tree reads Runner/ as the app and every sibling folder whose Info.plist has an
NSExtension as an extension; a built app reads PlugIns/*.appex. Built plists may be binary.
"""
import plistlib
import re
import sys
import tempfile
import zipfile
from pathlib import Path

REQUIRED_LANGUAGES = {"de", "en"}
INTENT = re.compile(r"^IN\w+Intent$")


def bundles(path: Path) -> tuple[Path, list[Path]]:
    """The app bundle and its extensions' bundles."""
    if path.suffix == ".app":
        return path, sorted(path.glob("PlugIns/*.appex"))
    app = path / "Runner"
    extensions = [
        d for d in sorted(path.iterdir())
        if d != app and (d / "Info.plist").is_file() and "NSExtension" in load(d / "Info.plist")
    ]
    return app, extensions


def load(path: Path) -> dict:
    with path.open("rb") as f:
        return plistlib.load(f)


def declared_intents(info: dict) -> set[str]:
    attributes = info.get("NSExtension", {}).get("NSExtensionAttributes", {})
    return (
        set(info.get("INIntentsSupported", []))
        | set(attributes.get("IntentsSupported", []))
        | {t for t in info.get("NSUserActivityTypes", []) if INTENT.match(t)}
    )


def check(path: Path) -> tuple[set[str], set[str], list[str]]:
    """The declared intents, the languages, and what is missing."""
    app, extensions = bundles(path)
    if not (app / "Info.plist").is_file():
        return set(), set(), [f"{app}/Info.plist is missing"]
    app_info = load(app / "Info.plist")
    name = app_info.get("CFBundleDisplayName") or app_info.get("CFBundleName")
    intents: dict[str, str] = {}
    for bundle in [app, *extensions]:
        for intent in declared_intents(load(bundle / "Info.plist")):
            intents.setdefault(intent, bundle.name)
    languages = REQUIRED_LANGUAGES | {d.stem for d in app.glob("*.lproj") if d.stem != "Base"}
    found = []
    for lang in sorted(languages) if intents else []:
        vocabulary = app / f"{lang}.lproj" / "AppIntentVocabulary.plist"
        if not vocabulary.is_file():
            found.append(f"{vocabulary} is missing ({', '.join(sorted(intents))} need examples)")
            continue
        examples: dict[str, list[str]] = {}
        for entry in load(vocabulary).get("IntentPhrases", []):
            examples.setdefault(entry.get("IntentName", ""), []).extend(
                e for e in entry.get("IntentExamples", []) if isinstance(e, str) and e.strip()
            )
        for intent, owner in sorted(intents.items()):
            said = examples.get(intent, [])
            if not said:
                found.append(f"{vocabulary}: no IntentExamples for {intent} (declared in {owner})")
            found += [
                f'{vocabulary}: {intent} example "{e}" does not name {name}'
                for e in said
                if name and name.lower() not in e.lower()
            ]
    return set(intents), languages, found


def main() -> int:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent.parent / "app/ios")
    with tempfile.TemporaryDirectory() as tmp:
        if target.suffix == ".ipa":
            with zipfile.ZipFile(target) as ipa:
                ipa.extractall(tmp)
            apps = sorted(Path(tmp).glob("Payload/*.app"))
            if not apps:
                print(f"siri-vocabulary: {target} has no Payload/*.app", file=sys.stderr)
                return 1
            target = apps[0]
        intents, languages, found = check(target)
    if found:
        print("\n".join(f"siri-vocabulary: {p}" for p in found), file=sys.stderr)
        return 1
    print(
        f"siri-vocabulary: {', '.join(sorted(intents)) or 'no intents'} have examples in "
        f"{', '.join(sorted(languages))}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
