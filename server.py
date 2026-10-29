"""Serve EasyKart and save help-form submissions. Run: python3 server.py"""
import json
import re
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "help_requests.json"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def reply(self, status, message):
        body = json.dumps({"message": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/api/help":
            self.reply(404, "Page not found.")
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if not 0 < length <= 10000:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Expected an object")
            # Validate again because browser validation can be bypassed.
            for field in ("name", "email", "message"):
                if not isinstance(data.get(field), str):
                    raise ValueError("Missing text field")
            name, email, message = (data[field].strip() for field in ("name", "email", "message"))
            if not (2 <= len(name) <= 80 and 10 <= len(message) <= 1000):
                raise ValueError("Invalid name or message length")
            if len(email) > 120 or not re.fullmatch(r"[^\s@]+@[^\s@]+", email):
                raise ValueError("Invalid email")
        except (ValueError, UnicodeError):
            self.reply(400, "Please enter a valid name, email and message.")
            return
        try:
            DATA_FILE.parent.mkdir(exist_ok=True)
            requests = json.loads(DATA_FILE.read_text(encoding="utf-8")) if DATA_FILE.exists() else []
            if not isinstance(requests, list):
                raise ValueError("Saved data must be a list")
            requests.append({"name": name, "email": email, "message": message,
                             "submitted_at": datetime.now().astimezone().isoformat()})
            # Replace the file after writing, so a partial write does not replace saved data.
            temporary = DATA_FILE.with_suffix(".tmp")
            temporary.write_text(json.dumps(requests, indent=2, ensure_ascii=False), encoding="utf-8")
            temporary.replace(DATA_FILE)
        except (OSError, ValueError):
            self.reply(500, "Could not save the request. Please try again.")
            return
        self.reply(200, "Request saved successfully. Thank you!")


if __name__ == "__main__":
    print("Open http://127.0.0.1:8000 — press Ctrl+C to stop.")
    HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
