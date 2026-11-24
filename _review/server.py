"""官网评审用的小服务器：照常提供 web/ 下的静态页面，另外把总览页上的
打勾打叉和留言存进 _review/feedback.json，方便 Claude 直接读。
只监听本机。用法：python server.py [端口，默认 8850]
"""
import json
import sys
import threading
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE.parent / "web"
STORE = HERE / "feedback.json"
LOCK = threading.Lock()
EMPTY = {"votes": {}, "notes": {}, "updated": None}


def load():
    try:
        return json.loads(STORE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return json.loads(json.dumps(EMPTY))


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/_api/feedback":
            with LOCK:
                return self._json(200, load())
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/_api/feedback":
            return self._json(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 200_000:
                return self._json(413, {"error": "too large"})
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            votes = {str(k): v for k, v in dict(data.get("votes", {})).items() if v in ("yes", "no")}
            notes = {
                str(k): [{"t": str(x.get("t", ""))[:40], "text": str(x.get("text", ""))[:2000]} for x in list(v)[:200]]
                for k, v in dict(data.get("notes", {})).items()
            }
        except (ValueError, TypeError, AttributeError):
            return self._json(400, {"error": "bad json"})
        out = {"votes": votes, "notes": notes, "updated": datetime.now().isoformat(timespec="seconds")}
        with LOCK:
            tmp = STORE.with_suffix(".tmp")
            tmp.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
            tmp.replace(STORE)
        return self._json(200, {"ok": True, "updated": out["updated"]})

    def log_message(self, fmt, *args):
        if "/_api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8850
    srv = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(WEB)))
    print(f"serving {WEB} on http://localhost:{port}/_all.html", flush=True)
    srv.serve_forever()
