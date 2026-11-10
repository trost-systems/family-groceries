#!/usr/bin/env python3
"""scripts/siri-vocabulary.py on fixture bundles: it passes a complete one and fails each gap."""
import plistlib
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

CHECK = Path(__file__).with_name("siri-vocabulary.py")
INTENTS = ["INAddTasksIntent", "INSearchForNotebookItemsIntent"]


def write(path: Path, value: dict, binary: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        plistlib.dump(value, f, fmt=plistlib.FMT_BINARY if binary else plistlib.FMT_XML)


def vocabulary(intents=INTENTS, example="Add milk to Snacklist") -> dict:
    return {
        "IntentPhrases": [{"IntentName": i, "IntentExamples": [example]} for i in intents],
        "ParameterVocabularies": [],
    }


class SiriVocabulary(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)

    def source_tree(self) -> Path:
        ios = self.root / "ios"
        write(ios / "Runner/Info.plist", {"CFBundleDisplayName": "Snacklist", "INIntentsSupported": INTENTS}, False)
        write(ios / "HomeWidget/Info.plist", {"NSExtension": {"NSExtensionPointIdentifier": "com.apple.widgetkit-extension"}}, False)
        for lang in ("de", "en"):
            write(ios / f"Runner/{lang}.lproj/AppIntentVocabulary.plist", vocabulary(), False)
        (ios / "Runner/Base.lproj").mkdir()
        return ios

    def built_app(self) -> Path:
        app = self.root / "Runner.app"
        write(app / "Info.plist", {"CFBundleDisplayName": "Snacklist", "INIntentsSupported": INTENTS}, True)
        write(app / "PlugIns/HomeWidget.appex/Info.plist", {"NSExtension": {}}, True)
        for lang in ("de", "en"):
            write(app / f"{lang}.lproj/AppIntentVocabulary.plist", vocabulary(), True)
        return app

    def ipa(self, app: Path) -> Path:
        ipa = self.root / "Snacklist.ipa"
        with zipfile.ZipFile(ipa, "w") as z:
            for f in app.rglob("*"):
                z.write(f, Path("Payload") / f.relative_to(app.parent))
        return ipa

    def run_check(self, target: Path) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, CHECK, target], capture_output=True, text=True)

    def assert_fails(self, target: Path, *words: str) -> None:
        result = self.run_check(target)
        self.assertEqual(result.returncode, 1, result.stdout)
        for word in words:
            self.assertIn(word, result.stderr)

    def test_complete_bundles_pass(self):
        for target in (self.source_tree(), self.built_app()):
            result = self.run_check(target)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("INAddTasksIntent, INSearchForNotebookItemsIntent have examples in de, en", result.stdout)

    def test_repository_passes(self):
        result = self.run_check(CHECK.parent.parent / "app/ios")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_one_intent_without_example_in_one_language_fails(self):
        ios = self.source_tree()
        write(ios / "Runner/en.lproj/AppIntentVocabulary.plist", vocabulary(["INAddTasksIntent"]), False)
        self.assert_fails(ios, "en.lproj/AppIntentVocabulary.plist: no IntentExamples for INSearchForNotebookItemsIntent")

    def test_empty_examples_fail(self):
        ios = self.source_tree()
        write(ios / "Runner/de.lproj/AppIntentVocabulary.plist", vocabulary(example=" "), False)
        self.assert_fails(ios, "de.lproj", "no IntentExamples for INAddTasksIntent")

    def test_missing_file_fails(self):
        ios = self.source_tree()
        (ios / "Runner/de.lproj/AppIntentVocabulary.plist").unlink()
        self.assert_fails(ios, "de.lproj/AppIntentVocabulary.plist is missing")

    def test_missing_language_folder_fails(self):
        app = self.built_app()
        (app / "en.lproj/AppIntentVocabulary.plist").unlink()
        (app / "en.lproj").rmdir()
        self.assert_fails(app, "en.lproj/AppIntentVocabulary.plist is missing")

    def test_other_language_needs_examples_too(self):
        ios = self.source_tree()
        (ios / "Runner/fr.lproj").mkdir()
        self.assert_fails(ios, "fr.lproj/AppIntentVocabulary.plist is missing")

    def test_example_without_app_name_fails(self):
        ios = self.source_tree()
        write(ios / "Runner/en.lproj/AppIntentVocabulary.plist", vocabulary(example="Add milk"), False)
        self.assert_fails(ios, 'INAddTasksIntent example "Add milk" does not name Snacklist')

    def test_extension_intent_needs_examples(self):
        app = self.built_app()
        write(app / "PlugIns/Intents.appex/Info.plist",
              {"NSExtension": {"NSExtensionAttributes": {"IntentsSupported": ["INSendMessageIntent"]}}}, True)
        self.assert_fails(app, "no IntentExamples for INSendMessageIntent (declared in Intents.appex)")

    def test_user_activity_intent_needs_examples(self):
        ios = self.source_tree()
        write(ios / "Runner/Info.plist", {"CFBundleDisplayName": "Snacklist", "INIntentsSupported": INTENTS,
                                          "NSUserActivityTypes": ["INPlayMediaIntent", "com.example.open"]}, False)
        result = self.run_check(ios)
        self.assertEqual(result.returncode, 1)
        self.assertIn("no IntentExamples for INPlayMediaIntent", result.stderr)
        self.assertNotIn("com.example.open", result.stderr)

    def test_ipa_is_checked_inside(self):
        app = self.built_app()
        self.assertEqual(self.run_check(self.ipa(app)).returncode, 0)
        (app / "de.lproj/AppIntentVocabulary.plist").unlink()
        self.assert_fails(self.ipa(app), "de.lproj/AppIntentVocabulary.plist is missing")


if __name__ == "__main__":
    unittest.main()
