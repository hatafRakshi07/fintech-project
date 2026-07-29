import urllib.request
import json

BASE = "https://fintech-project-tlgw.onrender.com"

def fetch(path):
    try:
        req = urllib.request.Request(BASE + path)
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.getcode(), r.read().decode()
    except Exception as e:
        return None, str(e)

# Try different health endpoints
paths = ["/api/health", "/api/healthz", "/api/v1/health", "/health", "/healthz"]
for p in paths:
    code, body = fetch(p)
    print(f"{p}: {code} - {body[:100]}")
