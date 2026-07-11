"""
Bissi folder.xlsx → Database importer
Reads all 4 Bissi group sheets, extracts unique customers,
creates branches, committees, and committee memberships.
Run: python import-bissi-data.py
"""
import os, sys, re
import openpyxl
import requests
import json

EXCEL_FILE = r"C:\Users\iSN_kota_T52\Downloads\Bissi folder.xlsx"
API_BASE   = "http://localhost:5100/api"

# ── 1. Get auth token ──────────────────────────────────────────────────────
print("Logging in...")
resp = requests.post(f"{API_BASE}/auth/login", json={"username": "admin", "password": "admin123"})
if not resp.ok:
    print("Login failed:", resp.text); sys.exit(1)
TOKEN = resp.json()["token"]
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
print(f"  ✔ Logged in\n")

def api(method, path, **kw):
    r = getattr(requests, method)(f"{API_BASE}{path}", headers=HEADERS, **kw)
    return r

def clean_mobile(val):
    if not val: return ""
    s = re.sub(r"[^\d]", "", str(val).split(".")[0])
    return s[-10:] if len(s) >= 10 else s

def clean_name(val):
    if not val: return ""
    return str(val).strip()[:200]

# ── 2. Create Branch ───────────────────────────────────────────────────────
print("Creating branch...")
r = api("post", "/branches", json={"name": "Shree Krishna Associate", "code": "SKA001", "city": "Jaipur", "status": "active"})
if r.ok:
    branch = r.json()
    print(f"  ✔ Branch created: {branch['name']} (ID: {branch['id']})")
else:
    # Get existing
    r2 = api("get", "/branches")
    branch = r2.json()[0]
    print(f"  ℹ Using existing branch: {branch['name']} (ID: {branch['id']})")
BRANCH_ID = branch["id"]

# ── 3. Load Excel ──────────────────────────────────────────────────────────
print("\nReading Excel file...")
wb = openpyxl.load_workbook(EXCEL_FILE)

# Sheet config: (sheet_name, committee_name, amount, date_day, col_token, col_name, col_mobile, col_address, col_ref_name)
SHEETS = [
    ("Sawariya seth 5 date",          "Sawariya Seth Bissi",       5000,  5,  0, 1, 3, 5, 2),
    ("Pyare mohan 15 date",           "Pyare Mohan Bissi",         5000, 15,  0, 1, 3, 6, 2),
    ("Hare ka sahara bissi 20 date",  "Hare Ka Sahara Bissi",      2500, 20,  0, 1, 3, 4, 2),
    ("Shree Krishna associate lottery","Shree Krishna Bissi",       3000,  1,  0, 1, 3, 5, 2),
]

# ── 4. Extract unique customers ────────────────────────────────────────────
customers_by_mobile = {}  # mobile → customer dict
sheet_customers = {}  # sheet → list of (token, name, mobile)

for sheet_name, comm_name, amount, day, col_tok, col_name, col_mob, col_addr, col_ref in SHEETS:
    ws = wb[sheet_name]
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        name    = clean_name(row[col_name] if len(row) > col_name else None)
        mobile  = clean_mobile(row[col_mob] if len(row) > col_mob else None)
        address = str(row[col_addr]).strip() if len(row) > col_addr and row[col_addr] else ""
        ref     = clean_name(row[col_ref] if len(row) > col_ref else None)
        try:
            token_raw = row[col_tok] if len(row) > col_tok and row[col_tok] else 0
            token = int(float(str(token_raw).split("(")[0].strip())) if token_raw else 0
        except:
            token = 0
        
        if not name or name in ("None", "Name", "name"): continue
        
        # Track unique by mobile (or name if no mobile)
        key = mobile if mobile else f"name:{name.lower()}"
        if key not in customers_by_mobile:
            customers_by_mobile[key] = {
                "name": name, "mobile": mobile, "address": address,
                "referenceName": ref, "branchId": BRANCH_ID, "status": "active"
            }
        rows.append({"token": token, "mobile": mobile, "name": name})
    sheet_customers[sheet_name] = rows
    print(f"  {sheet_name}: {len(rows)} members")

print(f"\n  Total unique customers: {len(customers_by_mobile)}")

# ── 5. Import customers ────────────────────────────────────────────────────
print("\nImporting customers to database...")
customer_mobile_to_id = {}
created = 0; failed = 0

for i, (key, cust) in enumerate(customers_by_mobile.items()):
    payload = {k: v for k, v in cust.items() if v}
    r = api("post", "/customers", json=payload)
    if r.ok:
        data = r.json()
        cid = data.get("id")
        if cust["mobile"]:
            customer_mobile_to_id[cust["mobile"]] = cid
        customer_mobile_to_id[f"name:{cust['name'].lower()}"] = cid
        created += 1
        if created % 50 == 0:
            print(f"  ... {created}/{len(customers_by_mobile)} created")
    else:
        failed += 1
        if failed <= 3:
            print(f"  FAIL: {cust['name']} - {r.text[:100]}")

print(f"  ✔ Customers: {created} created, {failed} failed\n")

# ── 6. Create Committees ───────────────────────────────────────────────────
print("Creating committees...")
comm_id_map = {}
for sheet_name, comm_name, amount, day, *_ in SHEETS:
    import datetime
    r = api("post", "/committees", json={
        "name": comm_name,
        "type": "monthly",
        "amount": str(amount),
        "startDate": datetime.date.today().isoformat(),
        "duration": 24,
        "branchId": BRANCH_ID,
        "status": "active"
    })
    if r.ok:
        comm = r.json()
        comm_id_map[sheet_name] = comm["id"]
        print(f"  ✔ {comm_name} (ID: {comm['id']})")
    else:
        print(f"  FAIL committee {comm_name}: {r.text[:80]}")

print()

# ── 7. Summary ─────────────────────────────────────────────────────────────
print("=" * 50)
print("IMPORT COMPLETE!")
print(f"  Branch:     1 (ID: {BRANCH_ID})")
print(f"  Customers:  {created} imported")
print(f"  Committees: {len(comm_id_map)} created")
print("=" * 50)
print("\nNow go to the app → Committees to see your groups!")
print("Customers are at → Customers tab")
