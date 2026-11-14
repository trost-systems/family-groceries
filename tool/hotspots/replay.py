#!/usr/bin/env python3
"""Replays main's history of a file: which PRs would have stopped in a rebase conflict on it with
git's default merge, and what would git's built-in `merge=union` and the `append-log` driver
(scripts/merge-append-log.sh) have made of each of those conflicts?

For each commit on main that touches the file and belongs to a PR, the base is main when the PR
was opened and the parent is main just before it landed. When another commit changed the file in
between (`concurrent`), the PR's change is rebuilt from the landed commit on the base and merged
with the parent the way a rebase would (`git merge-file parent base theirs`).

The change is rebuilt without a merge, so the result cannot flatter one: the landed commit's hunks
(parent -> commit) move onto the base through the base -> parent line mapping. A hunk that edits
lines the base does not have cannot move; the PR counts as `unmovable`.

The branches are gone, so this is not the PR before its author resolved a conflict: it is the
landed text put where the base has room for it. A merge that keeps the parent's insertion first
therefore comes out `as_landed` whenever the landed text sits after it. The count says how often
people resolved by hand in that order, and `conflict` where a strategy would still have stopped.

Per strategy, each default conflict is one of:
  conflict     the strategy stops too
  as_landed    it merges, byte-identical to the file as it landed
  blank_only   the same lines in the same order, blank lines aside
  reordered    the same lines, another order
  content      lines differ: the strategy would have changed what landed

Usage: tool/hotspots/replay.py <merged-prs.json> <path>...   (from the repository root)
  merged-prs.json: gh pr list --state merged --limit 1000 --json number,createdAt
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

REF = "origin/main"
DRIVER = Path(__file__).resolve().parents[2] / "scripts/merge-append-log.sh"
STRATEGIES = ("union", "append-log")
OUTCOMES = ("conflict", "as_landed", "blank_only", "reordered", "content")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def show(rev: str, path: str) -> bytes | None:
    shown = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True)
    return shown.stdout if shown.returncode == 0 else None


def hunks(a: Path, b: Path) -> list[tuple[int, int, int, int]]:
    """-U0 hunks as (a_after, a_len, b_after, b_len): the a_len lines after the first a_after
    lines of a become the b_len lines after the first b_after lines of b."""
    diff = subprocess.run(
        ["git", "diff", "--no-index", "-U0", "--no-color", str(a), str(b)], capture_output=True
    ).stdout
    found = []
    for m in re.finditer(rb"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", diff, re.M):
        a0, a_len, b0, b_len = int(m[1]), int(m[2] or 1), int(m[3]), int(m[4] or 1)
        found.append((a0 if a_len == 0 else a0 - 1, a_len, b0 if b_len == 0 else b0 - 1, b_len))
    return found


def as_written(d: Path) -> bytes | None:
    """The landed change (d/parent -> d/final) moved onto d/base, or None when it cannot move."""
    base_to_parent = hunks(d / "base", d / "parent")

    def in_base(p_after: int, p_len: int) -> int | None:
        shift = 0
        for b_after, b_len, q_after, q_len in base_to_parent:
            insert_here = p_len == 0 and q_after == p_after
            if q_after + q_len <= p_after and not (q_len == 0 and insert_here):
                shift += b_len - q_len
                continue
            if q_after >= p_after + p_len and not insert_here:
                break
            # An insertion inside or next to lines main changed goes after the base's version of
            # them: an append to a file main also appended to. Anything else edits changed lines.
            if p_len == 0 and q_after <= p_after <= q_after + q_len:
                return b_after + b_len
            return None
        return p_after + shift

    lines = (d / "base").read_bytes().splitlines(True)
    final = (d / "final").read_bytes().splitlines(True)
    edits = []
    for p_after, p_len, f_after, f_len in hunks(d / "parent", d / "final"):
        at = in_base(p_after, p_len)
        if at is None:
            return None
        edits.append((at, p_len, final[f_after:f_after + f_len]))
    for at, length, new in sorted(edits, key=lambda e: e[0], reverse=True):
        lines[at:at + length] = new
    return b"".join(lines)


def merged(d: Path, strategy: str) -> bytes | None:
    """d/theirs rebased onto d/parent, or None when the strategy stops in a conflict."""
    ours = d / "ours"
    shutil.copy(d / "parent", ours)
    if strategy == "append-log":
        run = subprocess.run([DRIVER, d / "base", ours, d / "theirs"], capture_output=True)
        return ours.read_bytes() if run.returncode == 0 else None
    flags = ["--union"] if strategy == "union" else []
    run = subprocess.run(["git", "merge-file", "-p", *flags, ours, d / "base", d / "theirs"], capture_output=True)
    return run.stdout if run.returncode == 0 else None


def compare(result: bytes, landed: bytes) -> str:
    if result == landed:
        return "as_landed"
    a, b = ([line for line in text.splitlines() if line.strip()] for text in (result, landed))
    if a == b:
        return "blank_only"
    return "reordered" if sorted(a) == sorted(b) else "content"


def replay(path: str, created: dict[int, float]) -> None:
    commits = []
    for line in git("log", REF, "--first-parent", "--reverse", "--format=%H %ct %s").splitlines():
        sha, time, subject = line.split(" ", 2)
        pr = re.search(r"\(#(\d+)\)$", subject)
        commits.append((sha, int(time), int(pr[1]) if pr else None))
    touching = set(git("log", REF, "--first-parent", "--format=%H", "--", path).split())
    counts = dict.fromkeys(("commits", "concurrent", "unmovable", "default_conflict"), 0)
    outcomes = {name: dict.fromkeys(OUTCOMES, 0) for name in STRATEGIES}
    named: dict[str, list[str]] = {}
    for i, (sha, _, pr) in enumerate(commits):
        if sha not in touching or i == 0:
            continue
        counts["commits"] += 1
        if pr not in created:
            continue
        base = max((j for j in range(i) if commits[j][1] <= created[pr]), default=None)
        if base is None or not any(commits[j][0] in touching for j in range(base + 1, i)):
            continue
        versions = {
            "base": show(commits[base][0], path),
            "parent": show(commits[i - 1][0], path),
            "final": show(sha, path),
        }
        if None in versions.values():
            continue
        counts["concurrent"] += 1
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            for name, content in versions.items():
                (d / name).write_bytes(content or b"")
            theirs = as_written(d)
            if theirs is None:
                counts["unmovable"] += 1
                continue
            (d / "theirs").write_bytes(theirs)
            if merged(d, "default") is not None:
                continue
            counts["default_conflict"] += 1
            for name in STRATEGIES:
                result = merged(d, name)
                outcome = "conflict" if result is None else compare(result, versions["final"] or b"")
                outcomes[name][outcome] += 1
                if outcome in ("reordered", "content") or (name == "append-log" and outcome != "as_landed"):
                    named.setdefault(f"{name} {outcome}", []).append(f"#{pr}")
    print(path, json.dumps(counts))
    for name, by_outcome in outcomes.items():
        print(f"  {name}: {json.dumps(by_outcome)}")
    for label, prs in named.items():
        print(f"  {label}: {' '.join(prs)}")


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 64
    created = {
        pr["number"]: datetime.fromisoformat(pr["createdAt"].replace("Z", "+00:00")).timestamp()
        for pr in json.loads(Path(sys.argv[1]).read_text())
    }
    for path in sys.argv[2:]:
        replay(path, created)
    return 0


if __name__ == "__main__":
    sys.exit(main())
