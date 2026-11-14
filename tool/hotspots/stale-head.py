#!/usr/bin/env python3
"""Counts the lands that merge-pr.sh refused as "behind main" right after push-pr.sh's push.

push-pr.sh rebases onto origin/main and pushes; merge-pr.sh then read the PR's head from GitHub's
record of the PR, which for some seconds still names the head before the push. That old head is
not on top of main, so the land stopped and went back into the merge queue. A tool result that
holds push-pr.sh's "pushed <sha> to #n" and, after it, merge-pr.sh's "is behind main" is such a
land, counted once per pushed commit. A "behind main" without a push before it in the same result
is counted apart, once per result: main had moved, the job ran the two scripts in separate
commands, or it read its land's log again.

A commit or a branch counts for the job whose transcript shows it first: a later job that prints
these lines while measuring them (job 218 did) adds nothing.

That the record lagged is inferred from the order of the two lines, not read from GitHub: a main
that moved between the two scripts would look the same.

Usage: tool/hotspots/stale-head.py <jobs dir>
  jobs dir: the runner's ops directory, jobs/<job>/*.jsonl.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

BEHIND = re.compile(r"(\S+) is behind main; run scripts/push-pr\.sh")
PUSHED = re.compile(r"pushed ([0-9a-f]{7,}) to #\d+")


def results(line: str) -> tuple[str, list[str]]:
    """One transcript line's timestamp and the text of each tool result in it."""
    try:
        entry = json.loads(line)
    except json.JSONDecodeError:
        return "", []
    content = entry.get("message", {}).get("content") if entry.get("type") == "user" else None
    found = []
    for block in content if isinstance(content, list) else []:
        if block.get("type") != "tool_result":
            continue
        text = block.get("content") or ""
        if isinstance(text, list):
            text = " ".join(part.get("text", "") for part in text if isinstance(part, dict))
        found.append(text)
    return entry.get("timestamp") or "", found


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 64
    # Pushed commit, or refused branch, to every (time, job, result) that shows it.
    pushed: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    alone: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    transcripts: set[str] = set()
    for transcript in sorted(Path(sys.argv[1]).glob("*/*.jsonl")):
        job = transcript.parent.name
        transcripts.add(job)
        with transcript.open(errors="ignore") as lines:
            for line in lines:
                if "is behind main" not in line:
                    continue
                time, texts = results(line)
                for text in texts:
                    for behind in BEHIND.finditer(text):
                        pushes = PUSHED.findall(text[: behind.start()])
                        if pushes:
                            pushed[pushes[-1]].append((time, job, text))
                        else:
                            alone[behind.group(1)].append((time, job, text))
    after_push: dict[str, set[str]] = defaultdict(set)
    apart: dict[str, set[str]] = defaultdict(set)
    for commit, shown in pushed.items():
        after_push[min(shown)[1]].add(commit)
    for shown in alone.values():
        first = min(shown)[1]
        apart[first].update(text for _, job, text in shown if job == first)
    for title, found in (
        ("refused as behind main right after a push", after_push),
        ("behind main without a push in the same result", apart),
    ):
        print(f"{title}: {sum(map(len, found.values()))} in {len(found)} of {len(transcripts)} jobs")
        for job, events in sorted(found.items()):
            print(f"{len(events):4}  {job}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
