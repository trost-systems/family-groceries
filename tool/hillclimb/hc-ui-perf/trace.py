#!/usr/bin/env python3
"""Where a flow's frame time goes: launches the ui_perf_probe build for one
flow (HC108_TRACE_FLOW) against a fresh fake_supabase.py, turns the VM
timeline on through the VM service (Dart, Embedder, GC), and prints the
events of the raster and UI threads by total self time. Not part of the
score; run it inside an X server (xvfb-run).

    trace.py <bundle dir> <port> <flow> <scenarios dir> [top]
"""

import collections
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
from frames import session  # noqa: E402


def call(base, method, **params):
    query = urllib.parse.urlencode({k: json.dumps(v) if not isinstance(v, str) else v for k, v in params.items()})
    with urllib.request.urlopen(f"{base}{method}?{query}", timeout=120) as r:
        body = json.load(r)
    if "result" not in body:
        raise SystemExit(f"trace: {method}: {body}")
    return body["result"]


def self_times(events):
    """Total and self time per (thread, name) from B/E and X events."""
    by_thread = collections.defaultdict(list)
    for e in events:
        if e.get("ph") in ("B", "E", "X"):
            by_thread[e["tid"]].append(e)
    names = {}
    for e in events:
        if e.get("ph") == "M" and e.get("name") == "thread_name":
            names[e["tid"]] = e["args"]["name"]
    out = collections.defaultdict(lambda: [0, 0, 0])
    for tid, evs in by_thread.items():
        spans = []
        stack = []
        for e in sorted(evs, key=lambda e: (e["ts"], 0 if e["ph"] == "E" else 1)):
            if e["ph"] == "X":
                spans.append((e["ts"], e["ts"] + e.get("dur", 0), e["name"]))
            elif e["ph"] == "B":
                stack.append(e)
            elif stack:
                b = stack.pop()
                spans.append((b["ts"], e["ts"], b["name"]))
        spans.sort(key=lambda s: (s[0], -(s[1] - s[0])))
        open_ = []
        for start, end, name in spans:
            while open_ and open_[-1][1] <= start:
                open_.pop()
            if open_:
                out[open_[-1][2]][1] -= end - start
            key = (names.get(tid, tid), name)
            out[key][0] += end - start
            out[key][1] += end - start
            out[key][2] += 1
            open_.append((start, end, key))
    return out


def main():
    bundle, port, flow, scenarios = Path(sys.argv[1]), int(sys.argv[2]), sys.argv[3], Path(sys.argv[4])
    top = int(sys.argv[5]) if len(sys.argv) > 5 else 25
    server = subprocess.Popen([sys.executable, str(HERE / "fake_supabase.py"), str(port), str(scenarios)])
    time.sleep(0.7)
    try:
        with tempfile.TemporaryDirectory(prefix="hc108-trace-") as home:
            data = Path(home, "data", "com.hummlist.app")
            data.mkdir(parents=True)
            (data / "shared_preferences.json").write_text(json.dumps({"flutter.sb-127-auth-token": session()}))
            env = {
                **os.environ,
                "HOME": home,
                "XDG_DATA_HOME": f"{home}/data",
                "XDG_CONFIG_HOME": f"{home}/config",
                "LANG": "C.UTF-8",
                "LANGUAGE": "de_DE",
                "HC108_TRACE_FLOW": flow,
                "FLUTTER_ENGINE_SWITCHES": "1",
                "FLUTTER_ENGINE_SWITCH_1": "enable-dart-profiling",
            }
            app = subprocess.Popen(
                [str(bundle / "family_groceries")], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
            )
            base = None
            lines = []
            result = None

            for line in app.stdout:
                lines.append(line)
                if base is None and (m := re.search(r"(http://127\.0\.0\.1:\d+/[^/\s]*/?)", line)):
                    base = m.group(1).rstrip("/") + "/"
                    call(base, "setVMTimelineFlags", recordedStreams="[Dart,Embedder,GC]")
                    call(base, "clearVMTimeline")
                if line.startswith("{"):
                    result = json.loads(line)
                    break
            if base is None or result is None:
                raise SystemExit("trace: no VM service or no result\n" + "".join(lines[-40:]))
            timeline = call(base, "getVMTimeline")
            isolate = call(base, "getVM")["isolates"][0]["id"]
            cpu = call(base, "getCpuSamples", isolateId=isolate, timeOriginMicros=0, timeExtentMicros=2**52)
            app.kill()
    finally:
        server.terminate()
    events = timeline["traceEvents"]
    times = self_times(events)
    print(f"flow {flow}: {len(result[flow]['frames'])} frames, {len(events)} events")
    print(f"semantics: {json.dumps(result[flow].get('semantics'), ensure_ascii=False)}")
    for thread in sorted({t for t, _ in times}, key=str):
        rows = sorted(((v, n) for (t, n), v in times.items() if t == thread), key=lambda r: -r[0][1])
        if not rows or sum(v[1] for v, _ in rows) < 1000:
            continue
        print(f"\n== {thread} (self ms, total ms, count)")
        for (total, own, count), name in rows[:top]:
            print(f"{own / 1000:10.1f} {total / 1000:10.1f} {count:7d}  {name}")
    Path(f"/tmp/hc108-cpu-{flow}.json").write_text(json.dumps(cpu))
    print_cpu(cpu, top)


def print_cpu(cpu, top):
    """The UI isolate's CPU samples: functions by exclusive and inclusive share."""
    funcs = cpu["functions"]

    def name(i):
        f = funcs[i]["function"]
        owner = f.get("owner", {}).get("name", "") if isinstance(f.get("owner"), dict) else ""
        url = funcs[i].get("resolvedUrl", "").rsplit("/", 2)[-2:]
        return f"{owner + '.' if owner else ''}{f.get('name')}  [{'/'.join(url)}]"

    samples = cpu["samples"]
    own = collections.Counter(s["stack"][0] for s in samples if s.get("stack"))
    incl = collections.Counter()
    for s in samples:
        for i in set(s.get("stack", [])):
            incl[i] += 1
    n = max(1, len(samples))
    print(f"\n== UI isolate CPU samples: {n} (period {cpu.get('samplePeriod')} us)")
    print("-- exclusive %")
    for i, c in own.most_common(top):
        print(f"{100 * c / n:6.1f}  {name(i)}")
    print("-- inclusive % (app code)")
    shown = 0
    for i, c in incl.most_common():
        if "family_groceries" in funcs[i].get("resolvedUrl", "") or "/list/" in funcs[i].get("resolvedUrl", ""):
            print(f"{100 * c / n:6.1f}  {name(i)}")
            shown += 1
            if shown >= top:
                break


if __name__ == "__main__":
    main()
