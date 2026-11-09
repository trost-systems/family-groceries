#!/usr/bin/env python3
"""A screenshot of the settled list (the window, 412x892) from a ui_perf_probe
build, for pixel comparisons between builds: the probe runs no flow
(HC108_TRACE_FLOW=none), and ffmpeg grabs the X display while it idles.
Run it inside an X server (xvfb-run); compare with --diff.

    shot.py <bundle dir> <port> <scenarios dir> <out.png>
    shot.py --diff <a.png> <b.png>
"""

import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
from frames import session  # noqa: E402


def diff(a, b):
    from PIL import Image, ImageChops

    x, y = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    delta = ImageChops.difference(x, y).convert("L").point(lambda v: 255 if v else 0)
    box = delta.getbbox()
    changed = delta.histogram()[255]
    print(json.dumps({"same": box is None, "changed_px": changed, "bbox": box}))


def shoot(bundle, port, scenarios, out):
    server = subprocess.Popen([sys.executable, str(HERE / "fake_supabase.py"), str(port), str(scenarios)])
    time.sleep(0.7)
    try:
        with tempfile.TemporaryDirectory(prefix="hc108-shot-") as home:
            data = Path(home, "data", "com.snacklist.app")
            data.mkdir(parents=True)
            (data / "shared_preferences.json").write_text(json.dumps({"flutter.sb-127-auth-token": session()}))
            env = {
                **os.environ,
                "HOME": home,
                "XDG_DATA_HOME": f"{home}/data",
                "XDG_CONFIG_HOME": f"{home}/config",
                "LANG": "C.UTF-8",
                "LANGUAGE": "de_DE",
                "HC108_TRACE_FLOW": "none",
            }
            app = subprocess.Popen(
                [str(bundle / "family_groceries")], env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True
            )
            for line in app.stdout:
                if line.startswith("{"):
                    break
            time.sleep(1)
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-f", "x11grab", "-video_size", "412x892",
                 "-i", os.environ["DISPLAY"], "-frames:v", "1", out],
                check=True,
            )
            app.kill()
    finally:
        server.terminate()


if __name__ == "__main__":
    if sys.argv[1] == "--diff":
        diff(sys.argv[2], sys.argv[3])
    else:
        shoot(Path(sys.argv[1]), int(sys.argv[2]), Path(sys.argv[3]), sys.argv[4])
