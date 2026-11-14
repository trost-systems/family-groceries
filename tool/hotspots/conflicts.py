#!/usr/bin/env python3
"""Counts the rebase and merge conflicts the job agents ran into, from their transcripts.

Main's history is linear (one commit per PR), so it keeps no trace of a conflict. The agents'
transcripts do: every tool result with git's `CONFLICT (...)` lines is one event (also one that
only quotes such a line, as a job reading another job's log does). Per file this
prints the events and the jobs that had at least one, then what an event cost when only the
append-only logs (the paths in .gitattributes with merge=append-log) conflicted: the assistant
entries in the transcript (a message is split into about two) and the wall time from the conflict
to the next finished rebase or push. A second such conflict before that end is part of the same
stretch.

Only the cost is an estimate: the end of an event is recognised by git's and push-pr.sh's
messages, and a job that did something else first counts that too. Token use per event is not
measured (the transcripts' usage fields repeat per stream chunk).

Usage: tool/hotspots/conflicts.py <jobs dir> [<job to skip>...]
  jobs dir: the runner's ops directory, jobs/<job>/*.jsonl. Skip a job whose transcript shows
  conflicts it made on purpose (job 218 rebased open PRs to compare).
"""
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

CONFLICT = re.compile(r"CONFLICT \([a-z/ ]+\): (?:Merge conflict in )?(\S+)")
RESOLVED = re.compile(r"Successfully rebased|pushed [0-9a-f]{7,} to #|is up to date|nothing to push")
ATTRIBUTES = Path(__file__).resolve().parents[2] / ".gitattributes"


def logs() -> set[str]:
    return {
        line.split()[0].lstrip("/")
        for line in ATTRIBUTES.read_text().splitlines()
        if "merge=append-log" in line and not line.startswith("#")
    }


def results(line: str) -> list[tuple[str, str]]:
    """(tool use id, text) of each tool result in one transcript line."""
    try:
        entry = json.loads(line)
    except json.JSONDecodeError:
        return []
    content = entry.get("message", {}).get("content") if entry.get("type") == "user" else None
    found = []
    for block in content if isinstance(content, list) else []:
        if block.get("type") != "tool_result":
            continue
        text = block.get("content") or ""
        if isinstance(text, list):
            text = " ".join(part.get("text", "") for part in text if isinstance(part, dict))
        found.append((block.get("tool_use_id", ""), text))
    return found


def at(line: str) -> datetime | None:
    stamp = re.search(r'"timestamp":"([^"]+)"', line)
    return datetime.fromisoformat(stamp[1].replace("Z", "+00:00")) if stamp else None


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 64
    append_logs = logs()
    events = Counter()
    jobs: dict[str, set[str]] = defaultdict(set)
    transcripts: set[str] = set()
    total = logs_only = 0
    messages: list[int] = []
    seconds: list[float] = []
    for transcript in sorted(Path(sys.argv[1]).glob("*/*.jsonl")):
        job = transcript.parent.name
        if job in sys.argv[2:]:
            continue
        transcripts.add(job)
        seen: set[str] = set()
        open_event: tuple[int, datetime | None] | None = None
        with transcript.open(errors="ignore") as lines:
            for line in lines:
                if open_event and '"type":"assistant"' in line:
                    open_event = (open_event[0] + 1, open_event[1])
                if "tool_result" not in line:
                    continue
                for use, text in results(line):
                    files = set(CONFLICT.findall(text))
                    if files and use not in seen:
                        seen.add(use)
                        total += 1
                        for path in files:
                            events[path] += 1
                            jobs[path].add(job)
                        if files <= append_logs:
                            logs_only += 1
                            open_event = open_event or (0, at(line))
                    elif open_event and RESOLVED.search(text):
                        messages.append(open_event[0])
                        end = at(line)
                        if open_event[1] and end:
                            seconds.append((end - open_event[1]).total_seconds())
                        open_event = None
    print(f"{len(transcripts)} jobs with transcripts, {total} conflict events")
    print("\nevents  jobs  file")
    for path, count in events.most_common(25):
        print(f"{count:6}  {len(jobs[path]):4}  {path}")
    hit = set().union(*(jobs[path] for path in append_logs))
    print(f"\njobs with a conflict in an append-only log: {len(hit)}")
    print(f"events in which only append-only logs conflicted: {logs_only} of {total}")
    if messages:
        print(
            f"cost of {len(messages)} stretches from such an event to a finished rebase or push: "
            f"median {statistics.median(messages):.0f} assistant entries"
            + (f", median {statistics.median(seconds):.0f} s" if seconds else "")
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
