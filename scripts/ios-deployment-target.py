#!/usr/bin/env python3
"""Every iOS target builds for the same minimum, IOS_MINIMUM (17.0 since job 97).

Checks each IPHONEOS_DEPLOYMENT_TARGET in Runner.xcodeproj (project, Runner, RunnerTests,
HomeWidget), the one scripts/ios/home-widget-target.rb writes, a Podfile `platform :ios` and
AppFrameworkInfo.plist's MinimumOSVersion where they exist, and that no Swift file still asks
`@available(iOS N, *)` / `#available(iOS N, *)` for an N the minimum already guarantees.

Swift is read from `git ls-files`, so plugin sources a local build links under Pods, .symlinks
or Flutter/ephemeral (Flutter's generated Swift packages) don't count. xcconfig files are not
read: none sets IPHONEOS_DEPLOYMENT_TARGET today; one that does must be added here.

Usage: scripts/ios-deployment-target.py [repo-root]
"""
import re
import subprocess
import sys
from pathlib import Path

IOS_MINIMUM = "17.0"


def version(text: str) -> tuple[int, ...]:
    return tuple(int(n) for n in text.split("."))


def tracked_swift(root: Path) -> list[Path]:
    """The app's own Swift, not plugin sources a local build links under Pods or ephemeral."""
    listed = subprocess.run(
        ["git", "-C", str(root), "ls-files", "--", "app/ios/*.swift"], capture_output=True, text=True
    )
    if listed.returncode == 0:
        return [root / line for line in listed.stdout.splitlines()]
    return sorted(
        p for p in (root / "app/ios").rglob("*.swift")
        if not {"Pods", ".symlinks", "ephemeral"} & set(p.relative_to(root).parts)
    )


def check(root: Path) -> list[str]:
    ios = root / "app/ios"
    found: list[str] = []
    pbxproj = ios / "Runner.xcodeproj/project.pbxproj"
    targets = re.findall(r"IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);", pbxproj.read_text())
    if not targets:
        found.append(f"{pbxproj}: no IPHONEOS_DEPLOYMENT_TARGET")
    found += [
        f"{pbxproj}: IPHONEOS_DEPLOYMENT_TARGET = {t}, want {IOS_MINIMUM}"
        for t in targets
        if t != IOS_MINIMUM
    ]
    widget = root / "scripts/ios/home-widget-target.rb"
    if widget.is_file():
        found += [
            f"{widget}: IPHONEOS_DEPLOYMENT_TARGET {t}, want {IOS_MINIMUM}"
            for t in re.findall(r'"IPHONEOS_DEPLOYMENT_TARGET" => "([\d.]+)"', widget.read_text())
            if t != IOS_MINIMUM
        ]
    podfile = ios / "Podfile"
    if podfile.is_file():
        platforms = re.findall(r"^\s*platform :ios, '([\d.]+)'", podfile.read_text(), re.M)
        if platforms != [IOS_MINIMUM]:
            found.append(f"{podfile}: platform :ios {platforms or 'missing'}, want '{IOS_MINIMUM}'")
    framework = ios / "Flutter/AppFrameworkInfo.plist"
    if framework.is_file():
        minimum = re.search(r"<key>MinimumOSVersion</key>\s*<string>([\d.]+)</string>", framework.read_text())
        if minimum and minimum[1] != IOS_MINIMUM:
            found.append(f"{framework}: MinimumOSVersion {minimum[1]}, want {IOS_MINIMUM}")
    for swift in tracked_swift(root):
        for number, line in enumerate(swift.read_text().splitlines(), 1):
            for asked in re.findall(r"[@#]available\(iOS ([\d.]+)", line):
                if version(asked) <= version(IOS_MINIMUM):
                    found.append(
                        f"{swift}:{number}: asks for iOS {asked}, which the minimum {IOS_MINIMUM} "
                        "already guarantees; drop the check"
                    )
    return found


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent)
    found = check(root)
    if found:
        print("\n".join(f"ios-deployment-target: {p}" for p in found), file=sys.stderr)
        return 1
    print(f"ios-deployment-target: every target builds for iOS {IOS_MINIMUM}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
