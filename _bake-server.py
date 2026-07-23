# -*- coding: utf-8 -*-
"""Local bake receiver: POST JSON -> publish/assets/maps/live-pack.json"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json
from datetime import datetime

ROOT = Path(r"D:/dzmm版本修仙")
OUT = ROOT / "publish/assets/maps/live-pack.json"
PORT = 5199


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        exists = OUT.exists()
        msg = f"bake server ok\nout={OUT}\nexists={exists}\n"
        if exists:
            msg += f"size={OUT.stat().st_size}\n"
        self.wfile.write(msg.encode("utf-8"))

    def do_POST(self):
        if self.path.rstrip("/") != "/bake":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n)
        try:
            pack = json.loads(raw.decode("utf-8"))
        except Exception as e:
            self.send_response(400)
            self._cors()
            self.end_headers()
            self.wfile.write(f"invalid json: {e}".encode("utf-8"))
            return
        if not isinstance(pack, dict) or not isinstance(pack.get("worlds"), dict):
            self.send_response(400)
            self._cors()
            self.end_headers()
            self.wfile.write(b"missing worlds")
            return
        pack["version"] = 1
        pack["bakedAt"] = datetime.now().isoformat(timespec="seconds")
        OUT.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(pack, ensure_ascii=False, indent=2)
        OUT.write_text(text, encoding="utf-8")
        worlds = pack["worlds"]
        summary = {
            "ok": True,
            "path": str(OUT).replace("\\", "/"),
            "bytes": len(text.encode("utf-8")),
            "worlds": {
                wid: {
                    "kind": w.get("kind"),
                    "mapId": w.get("mapId"),
                    "entities": len(w.get("entities") or []),
                    "terrain": sum(
                        1
                        for e in (w.get("entities") or [])
                        if str(e.get("kind", "")).startswith("terrain-")
                    ),
                }
                for wid, w in worlds.items()
            },
        }
        body = json.dumps(summary, ensure_ascii=False)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))
        print("[bake]", summary)

    def log_message(self, fmt, *args):
        print("[bake-http]", fmt % args)


if __name__ == "__main__":
    print(f"Bake server http://127.0.0.1:{PORT}/bake -> {OUT}")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
