#!/usr/bin/env python3
"""Where main changes: the files most commits touch, and the pairs that change together.

One commit on main is one PR, so a file's count is the number of PRs that edited it. A pair's
degree is the share of the rarer file's commits that also touch the other one; 1.00 means the
rarer file never changes alone. Pairs skip prose, generated and binary files, files that are gone,
and sweeps (commits over 60 files), which would pair everything with everything.

Counts say where edits meet, not that they collide: tool/hotspots/replay.py and conflicts.py
measure collisions.

Usage: tool/hotspots/history.py [<top files, default 30> [<least shared commits, default 8>]]
"""
import itertools
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

REF = "origin/main"
SWEEP = 60
NOT_CODE = re.compile(
    r"^(docs|site|releases)/|^DONE_SUMMARY|/features/|/goldens/|/l10n/"
    r"|\.(md|png|jpg|gif|svg|mp4|webm|lock|arb)$"
)


def commits() -> list[set[str]]:
    log = subprocess.run(
        ["git", "log", REF, "--first-parent", "--name-only", "--format=%x00%h"],
        capture_output=True, text=True, check=True,
    ).stdout
    return [set(block.splitlines()[1:]) - {""} for block in log.split("\0")[1:]]


def main() -> int:
    top = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    least = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    history = commits()
    changes = Counter(path for files in history for path in files)
    print(f"{len(history)} commits on {REF}")
    print("\ncommits  lines  file")
    for path, count in changes.most_common(top):
        lines = len(Path(path).read_bytes().splitlines()) if Path(path).is_file() else "gone"
        print(f"{count:7}  {lines:>5}  {path}")
    code = Counter()
    pairs = Counter()
    for files in history:
        kept = sorted(p for p in files if not NOT_CODE.search(p) and Path(p).is_file())
        if len(kept) > SWEEP:
            continue
        code.update(kept)
        pairs.update(itertools.combinations(kept, 2))
    print(f"\nshared  degree  pair (commits of each), {least} shared commits or more")
    rows = [(n, n / min(code[a], code[b]), a, b) for (a, b), n in pairs.items() if n >= least]
    for n, degree, a, b in sorted(rows, reverse=True):
        print(f"{n:6}  {degree:6.2f}  {a} ({code[a]})  {b} ({code[b]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
