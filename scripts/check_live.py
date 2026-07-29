import urllib.request
import json

BASE = "https://fintech-project-tlgw.onrender.com"

def fetch(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"error": str(e)}

health = fetch("/api/health")
print("Health:", health)

customers = fetch("/api/customers?limit=3")
print("Customers total:", customers.get("total", "N/A"))
if customers.get("customers"):
    print("First customer:", customers["customers"][0].get("name", ""))

committees = fetch("/api/committees")
comms = committees.get("committees", committees.get("data", []))
print("Committees count:", len(comms))
for c in comms:
    print(f"  - {c.get('id')}: {c.get('name')}")
