#!/usr/bin/env bash
# Tests download.sh's retries and deno-toolcache.sh's version pick against a local HTTP server:
# /flaky answers 404, then 504, then 200 (a 404 retries only with --retry-all-errors), /stall
# accepts and never answers the first time, /down always 504, /versions.json serves a fixture,
# /good and /bad serve a fake Deno release zip with a matching and a wrong .sha256sum.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
server_pid=
cleanup() {
  [[ -z $server_pid ]] || kill "$server_pid" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

mkdir "$tmp/server" "$tmp/out"
cat >"$tmp/server/server.py" <<'PY'
import collections, hashlib, http.server, io, sys, time, zipfile

counts = collections.Counter()
versions = open(sys.argv[1], "rb").read()
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as z:
    info = zipfile.ZipInfo("deno")
    info.external_attr = 0o755 << 16
    z.writestr(info, "#!/bin/sh\necho 'deno 9.9.9 (fake)'\n")
release = buf.getvalue()
digest = hashlib.sha256(release).hexdigest()

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        counts[self.path] += 1
        if self.path == "/count/flaky":
            self.reply(200, str(counts["/flaky"]).encode())
        elif self.path == "/count/down":
            self.reply(200, str(counts["/down"]).encode())
        elif self.path == "/count/stall":
            self.reply(200, str(counts["/stall"]).encode())
        elif self.path == "/flaky" and counts["/flaky"] == 1:
            self.reply(404, b"not found\n")
        elif self.path == "/flaky" and counts["/flaky"] > 2:
            self.reply(200, b"flaky body\n")
        elif self.path == "/stall" and counts["/stall"] == 1:
            time.sleep(60)
        elif self.path == "/stall":
            self.reply(200, b"stall body\n")
        elif self.path.endswith(".zip"):
            self.reply(200, release)
        elif self.path.startswith("/good/") and self.path.endswith(".zip.sha256sum"):
            self.reply(200, f"{digest}  deno.zip\n".encode())
        elif self.path.startswith("/bad/") and self.path.endswith(".zip.sha256sum"):
            self.reply(200, f"{'0' * 64}  deno.zip\n".encode())
        elif self.path == "/versions.json":
            self.reply(200, versions)
        else:
            self.reply(504, b"gateway timeout\n")

    def reply(self, status, body):
        self.send_response(status)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
print(server.server_address[1], flush=True)
server.daemon_threads = True
server.serve_forever()
PY
cat >"$tmp/server/versions.json" <<'JSON'
{"cli":["v3.0.0","v2.10.1","v2.9.12","v2.11.0-rc.1","v2.9.8","v1.46.3","v2.10.0"]}
JSON

python3 -I "$tmp/server/server.py" "$tmp/server/versions.json" >"$tmp/port" &
server_pid=$!
for _ in $(seq 50); do
  [[ -s $tmp/port ]] && break
  sleep 0.1
done
base="http://127.0.0.1:$(cat "$tmp/port")"
export FG_DOWNLOAD_RETRIES=3 FG_DOWNLOAD_STALL_SECONDS=2

failures=0
check() {
  if [[ "$2" == "$3" ]]; then
    echo "ok: $1"
  else
    echo "FAIL: $1: got '$2', expected '$3'" >&2
    failures=$((failures + 1))
  fi
}

"$here/download.sh" "$base/flaky" "$tmp/out/flaky" 2>/dev/null || true
check "download.sh retries a 404 and a 504 and keeps the body" "$(cat "$tmp/out/flaky" 2>/dev/null)" "flaky body"

started=$SECONDS
"$here/download.sh" "$base/stall" "$tmp/out/stall" 2>/dev/null || true
check "download.sh ends a stalled attempt and retries" "$(cat "$tmp/out/stall" 2>/dev/null)" "stall body"
check "download.sh gives up on the stall within 15 s" "$((SECONDS - started < 15))" 1
check "download.sh needed two attempts for the stall" "$(curl -fsS "$base/count/stall")" 2

status=0
"$here/download.sh" "$base/down" "$tmp/out/down" 2>/dev/null || status=$?
check "download.sh fails when every attempt is a 504" "$((status != 0))" 1
check "download.sh makes FG_DOWNLOAD_RETRIES+1 attempts" \
  "$(curl -fsS "$base/count/down")" "$((FG_DOWNLOAD_RETRIES + 1))"

export FG_DENO_VERSIONS_URL="$base/versions.json"
check "resolve v2.x picks the newest stable 2.x" "$("$here/deno-toolcache.sh" resolve v2.x)" 2.10.1
check "resolve 2.x without the v" "$("$here/deno-toolcache.sh" resolve 2.x)" 2.10.1
check "resolve v1.x" "$("$here/deno-toolcache.sh" resolve v1.x)" 1.46.3
check "resolve of an exact version (.dvmrc) prints it without the network" \
  "$(FG_DENO_VERSIONS_URL="$base/down" "$here/deno-toolcache.sh" resolve v2.9.8)" 2.9.8
status=0; "$here/deno-toolcache.sh" resolve '^2.9' >/dev/null 2>&1 || status=$?
check "resolve of another range form fails" "$((status != 0))" 1
status=0; "$here/deno-toolcache.sh" resolve v9.x >/dev/null 2>&1 || status=$?
check "resolve of a major without releases fails" "$((status != 0))" 1
status=0; FG_DENO_VERSIONS_URL="$base/down" "$here/deno-toolcache.sh" resolve v2.x >/dev/null 2>&1 || status=$?
check "resolve fails when versions.json cannot be fetched" "$((status != 0))" 1

export RUNNER_TOOL_CACHE="$tmp/toolcache"
FG_DENO_RELEASES_URL="$base/good" "$here/deno-toolcache.sh" fetch 9.9.9 >/dev/null 2>&1 || true
check "fetch installs a release whose sha256 matches" \
  "$(find "$RUNNER_TOOL_CACHE/deno/9.9.9" -name deno -type f | wc -l | tr -d ' ')" 1
rm -rf "$RUNNER_TOOL_CACHE"
status=0; FG_DENO_RELEASES_URL="$base/bad" "$here/deno-toolcache.sh" fetch 9.9.9 >/dev/null 2>&1 || status=$?
check "fetch fails on a sha256 mismatch" "$((status != 0))" 1
check "fetch leaves nothing behind on a mismatch" "$([[ -e $RUNNER_TOOL_CACHE/deno/9.9.9 ]] && echo present || echo absent)" absent

[[ $failures -eq 0 ]]
