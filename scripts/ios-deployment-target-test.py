#!/usr/bin/env python3
"""scripts/ios-deployment-target.py on fixture trees: it passes an agreeing one and fails each gap."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

CHECK = Path(__file__).with_name("ios-deployment-target.py")
TARGETS = "\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;\n" * 3


class DeploymentTarget(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.write("app/ios/Runner.xcodeproj/project.pbxproj", TARGETS)
        self.write("scripts/ios/home-widget-target.rb", '"IPHONEOS_DEPLOYMENT_TARGET" => "17.0",\n')
        self.write("app/ios/Runner/Intents.swift", "@available(iOS 26.0, *)\nstruct A {}\n")

    def write(self, path: str, text: str) -> None:
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text)

    def run_check(self) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, CHECK, self.root], capture_output=True, text=True)

    def assertFails(self, needle: str) -> None:
        result = self.run_check()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(needle, result.stderr)

    def test_agreeing_targets_pass(self):
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_one_target_left_on_15_fails(self):
        self.write("app/ios/Runner.xcodeproj/project.pbxproj", TARGETS + "\t\tIPHONEOS_DEPLOYMENT_TARGET = 15.0;\n")
        self.assertFails("IPHONEOS_DEPLOYMENT_TARGET = 15.0")

    def test_the_widget_generator_must_agree(self):
        self.write("scripts/ios/home-widget-target.rb", '"IPHONEOS_DEPLOYMENT_TARGET" => "16.0",\n')
        self.assertFails("home-widget-target.rb")

    def test_a_podfile_must_agree(self):
        self.write("app/ios/Podfile", "platform :ios, '15.0'\n")
        self.assertFails("platform :ios")
        self.write("app/ios/Podfile", "platform :ios, '17.0'\n")
        self.assertEqual(self.run_check().returncode, 0)

    def test_framework_info_must_agree(self):
        self.write("app/ios/Flutter/AppFrameworkInfo.plist", "<key>MinimumOSVersion</key>\n<string>13.0</string>")
        self.assertFails("MinimumOSVersion 13.0")

    def test_plugin_sources_of_a_local_build_are_not_the_apps(self):
        self.write("app/ios/Flutter/ephemeral/Packages/.packages/home_widget/Plugin.swift", "if #available(iOS 14.0, *) {}\n")
        self.write("app/ios/Pods/X/a.swift", "@available(iOS 16.0, *)\n")
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_only_tracked_swift_counts_in_a_repository(self):
        subprocess.run(["git", "init", "-q", self.root], check=True)
        subprocess.run(["git", "-C", self.root, "add", "app/ios/Runner/Intents.swift"], check=True)
        self.write("app/ios/Runner/Untracked.swift", "if #available(iOS 16.0, *) {}\n")
        self.assertEqual(self.run_check().returncode, 0)
        subprocess.run(["git", "-C", self.root, "add", "app/ios/Runner/Untracked.swift"], check=True)
        self.assertFails("Untracked.swift:1")

    def test_a_dead_availability_check_fails(self):
        self.write("app/ios/Runner/Intents.swift", "if #available(iOS 17.0, *) {}\n")
        self.assertFails("Intents.swift:1")


if __name__ == "__main__":
    unittest.main()
