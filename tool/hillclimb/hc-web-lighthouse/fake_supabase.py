#!/usr/bin/env python3
"""The Supabase endpoints the web app calls from launch until its list shows, answered from a
fixed household (no real data, no network), with CORS for the page on another port. The
realtime socket answers 404, so the list runs offline-marked, as on a flaky start. Paths it
does not know go to stderr, so a new call the app starts making shows up in the measure log.

    fake_supabase.py <port>
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

USER = "00000000-0000-4000-8000-000000000001"
HOUSEHOLD = "00000000-0000-4000-8000-0000000000aa"
CATEGORIES = ["Obst & Gemüse", "Brot & Backwaren", "Milchprodukte", "Fleisch & Fisch", "Getränke", "Haushalt"]
NAMES = [
    "Äpfel", "Bananen", "Tomaten", "Gurke", "Brötchen", "Vollkornbrot", "Milch", "Joghurt",
    "Butter", "Käse", "Hähnchenbrust", "Lachs", "Mineralwasser", "Orangensaft", "Kaffee",
    "Spülmittel", "Küchenrolle", "Müllbeutel", "Paprika", "Zwiebeln", "Quark", "Eier",
    "Hackfleisch", "Apfelschorle",
]
STAMP = "2026-11-01T10:00:00+00:00"
AUTH_USER = {
    "id": USER,
    "aud": "authenticated",
    "role": "authenticated",
    "email": "peter@example.test",
    "app_metadata": {"provider": "email", "providers": ["email"]},
    "user_metadata": {},
    "created_at": STAMP,
    "updated_at": STAMP,
    "email_confirmed_at": STAMP,
}


def category_id(i):
    return f"00000000-0000-4000-8000-0000000c{i:04d}"


def item(i, name, status="active"):
    return {
        "id": f"00000000-0000-4000-8000-00000001{i:04d}",
        "name": name,
        "quantity": "2" if i % 5 == 0 else None,
        "brand": None,
        "properties": None,
        "category_id": category_id(i % len(CATEGORIES)),
        "store_id": None,
        "sort_key": None,
        "status": status,
        "created_at": STAMP,
        "updated_at": STAMP,
        "bought_at": None,
        "added_by": USER,
        "categorized_via": "seed",
        "canonical_key": name.lower(),
    }


ITEMS = [item(i, n) for i, n in enumerate(NAMES)]
TABLES = {
    "categories": [
        {"id": category_id(i), "name": n, "sort_order": i, "seed_key": None} for i, n in enumerate(CATEGORIES)
    ],
    "stores": [],
    "store_category_order": [],
    "profiles": [{"id": USER, "display_name": "Peter"}],
    "entitlements": [],
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        pass

    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Expose-Headers", "*")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _unknown(self):
        print(f"fake_supabase: unknown {self.command} {self.path}", file=sys.stderr, flush=True)
        self._send(404, {"message": "not here"})

    def _rows(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        table = url.path.removeprefix("/rest/v1/")
        if table == "household_members":
            if "user_id" in query:
                return {"households": {"id": HOUSEHOLD, "name": "Zuhause"}}
            return [{"user_id": USER, "role": "owner"}]
        if table == "items":
            return [] if query.get("status") == ["eq.bought"] else ITEMS
        return TABLES.get(table)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", self.headers.get("Access-Control-Request-Headers", "*"))
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/auth/v1/user"):
            return self._send(200, AUTH_USER)
        if self.path.startswith("/realtime/v1/websocket"):
            return self._send(404, {"message": "no realtime"})
        if not self.path.startswith("/rest/v1/"):
            return self._unknown()
        rows = self._rows()
        if rows is None:
            return self._unknown()
        single = "vnd.pgrst.object" in self.headers.get("Accept", "")
        if isinstance(rows, dict) and not single:
            rows = [rows]
        self._send(200, rows)

    def do_HEAD(self):
        self._send(200, [])

    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length") or 0))
        if self.path.startswith("/rest/v1/"):
            return self._send(200, [])
        self._unknown()

    def do_PATCH(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        target = parse_qs(urlparse(self.path).query).get("id", [""])[0].removeprefix("eq.")
        self._send(200, [{**row, **body} for row in ITEMS if row["id"] == target])


class Server(ThreadingHTTPServer):
    # The app opens several connections at once; the default backlog of 5 drops a SYN now and
    # then, and the client resends it a second later.
    request_queue_size = 128

    def handle_error(self, request, client_address):
        # A page closed mid-request (each Lighthouse run ends with the browser) resets the socket.
        if not isinstance(sys.exc_info()[1], ConnectionError):
            super().handle_error(request, client_address)


if __name__ == "__main__":
    Server(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
