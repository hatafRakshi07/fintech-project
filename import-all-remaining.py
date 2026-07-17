"""
import os
Import ALL remaining data from Bissi folder.xlsx:
1. Gift categories & inventory (gift stock maintain)
2. Gift distributions (per committee gift records)
3. Collections (Daily collection + COLLECTION office 2)
"""
import os
import re, datetime, psycopg2, psycopg2.extras, openpyxl
import os
from collections import defaultdict

DB_URL    = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
XLSX_FILE = os.path.join(os.path.expanduser("~"), "Downloads", "Bissi folder.xlsx")

def cn(v): return str(v).strip()[:200] if v and str(v).strip() != 'None' else None
def mob(v):
    if not v: return None
    s = re.sub(r"[^\d]", "", str(v).split("/")[0].split(".")[0])
    return s[-10:] if len(s) >= 10 else (s if len(s) >= 6 else None)
def amt(v):
    if not v: return None
    m = re.search(r"\d+(?:\.\d+)?", str(v).replace(",",""))
    return float(m.group()) if m else None
def parse_date(v):
    if not v: return None
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    s = str(v).strip()
    for fmt in ("%d/%m/%y","%d/%m/%Y","%Y-%m-%d","%d-%m-%Y"):
        try: return datetime.datetime.strptime(s, fmt).date().isoformat()
        except: pass
    return None

print("Connecting...")
conn = psycopg2.connect(DB_URL)
cur  = conn.cursor()
print("  Connected!\n")

# Get IDs
cur.execute("SELECT id FROM branches WHERE code='SKA001'")
BRANCH_ID = cur.fetchone()[0]
today = datetime.date.today().isoformat()

# Build customer lookup maps
cur.execute("SELECT id, mobile, name FROM customers WHERE branch_id=%s", (BRANCH_ID,))
mob_to_id = {}; name_to_id = {}
for cid, m, n in cur.fetchall():
    if m: mob_to_id[m] = cid
    if n: name_to_id[re.sub(r"\([^)]*\)","",n).strip().lower()] = cid

# Build committee + token maps
cur.execute("SELECT id, name FROM committees WHERE branch_id=%s", (BRANCH_ID,))
comm_name_map = {r[1]: r[0] for r in cur.fetchall()}
cur.execute("SELECT committee_id, token_number, customer_id FROM tokens")
token_cid = {(r[0], str(int(float(r[1])))): r[2] for r in cur.fetchall()}

wb = openpyxl.load_workbook(XLSX_FILE)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 1. GIFT CATEGORIES & INVENTORY
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("--- Gift Categories & Inventory ---")
ws = wb['gift stock maintain']
gift_name_to_id = {}  # gift_name (lower) â†’ gift_inventory.id

cur.execute("SELECT COUNT(*) FROM gift_categories WHERE branch_id=%s", (BRANCH_ID,))
if cur.fetchone()[0] == 0:
    # Single category "Bissi Gifts"
    cur.execute("INSERT INTO gift_categories (name, branch_id, created_at, updated_at) VALUES ('Bissi Gifts', %s, NOW(), NOW()) RETURNING id", (BRANCH_ID,))
    cat_id = cur.fetchone()[0]
    print(f"  Created category: Bissi Gifts (ID: {cat_id})")

    inv_rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        gift = cn(row[0]); qty = int(row[1]) if row[1] else 0
        if not gift or gift.lower() in ('gift','none',''): continue
        inv_rows.append((cat_id, gift, qty, qty, 0, 'available', BRANCH_ID, today))

    psycopg2.extras.execute_values(cur, """
        INSERT INTO gift_inventory (category_id, name, quantity_total, quantity_available, quantity_distributed, status, branch_id, added_at, created_at, updated_at)
        VALUES %s RETURNING id, name
    """, [(c,n,qt,qa,qd,st,b,ad,datetime.datetime.now(),datetime.datetime.now())
          for c,n,qt,qa,qd,st,b,ad in inv_rows], page_size=50)
    for row in cur.fetchall():
        gift_name_to_id[row[1].lower().strip()] = row[0]
    conn.commit()
    print(f"  Inserted {len(inv_rows)} gift items")
else:
    cur.execute("SELECT id, name FROM gift_inventory WHERE branch_id=%s", (BRANCH_ID,))
    for gid, gn in cur.fetchall():
        gift_name_to_id[gn.lower().strip()] = gid
    print(f"  {len(gift_name_to_id)} gift items already exist")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 2. GIFT DISTRIBUTIONS  
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n--- Gift Distributions ---")
GIFT_SHEETS = [
    ('Sawariya seth bissi gift record', 'Sawariya Seth Bissi',       0, 1, 3),
    ('Hare ka sahara bissi gift recor',  'Hare Ka Sahara Bissi',     0, 1, 3),
    ('Shree krishna aasociates gift r',  'Shree Krishna Bissi',      0, 1, 3),
]

cur.execute("SELECT COUNT(*) FROM gift_distributions", ())
if cur.fetchone()[0] == 0:
    dist_rows = []
    for sheet_name, comm_name, col_tok, col_name, col_mob in GIFT_SHEETS:
        ws = wb[sheet_name]
        comm_id = comm_name_map.get(comm_name)
        # Headers row: first 5 cols = token/name/ref/mobile/ref_mob, then dates
        header_row = [c.value for c in ws[1]]
        date_cols = [(i, c) for i, c in enumerate(header_row) if isinstance(c, datetime.datetime)]

        for row in ws.iter_rows(min_row=2, values_only=True):
            token_raw = row[col_tok]
            try: token = str(int(float(str(token_raw).split("(")[0]))) if token_raw else None
            except: token = None
            mobile = mob(row[col_mob])
            name_raw = cn(row[col_name])

            # Resolve customer
            cust_id = mob_to_id.get(mobile) if mobile else None
            if not cust_id and token and comm_id:
                cust_id = token_cid.get((comm_id, token))
            if not cust_id and name_raw:
                base = re.sub(r"\([^)]*\)","",name_raw).strip().lower()
                cust_id = name_to_id.get(base)
            if not cust_id: continue

            # Check each date column for gift name
            for col_idx, dt in date_cols:
                if col_idx >= len(row): continue
                gift_val = cn(row[col_idx])
                if not gift_val: continue
                # Find gift inventory id
                gift_id = gift_name_to_id.get(gift_val.lower().strip())
                if not gift_id:
                    # Try partial match
                    for k, v in gift_name_to_id.items():
                        if gift_val.lower() in k or k in gift_val.lower():
                            gift_id = v; break
                if not gift_id: continue
                dist_date = dt.date().isoformat()
                dist_rows.append((gift_id, cust_id, comm_id, 1, 'given', dist_date, BRANCH_ID))

    if dist_rows:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO gift_distributions (gift_id, customer_id, committee_id, quantity, status, distribution_date, branch_id, created_at, updated_at)
            VALUES %s
        """, [(g,c,cm,q,s,d,b,datetime.datetime.now(),datetime.datetime.now()) for g,c,cm,q,s,d,b in dist_rows],
        page_size=200)
        conn.commit()
        print(f"  Inserted {len(dist_rows)} gift distributions")
    else:
        print("  No gift distributions found")
else:
    print("  Gift distributions already exist, skipping")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 3. COLLECTIONS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n--- Collections (Daily collection + office 2) ---")
COLL_SHEETS = ['Daily collection', 'COLLECTION office 2', 'nikku ji online', 'Manager collection']

cur.execute("SELECT COUNT(*) FROM collections WHERE branch_id=%s", (BRANCH_ID,))
if cur.fetchone()[0] == 0:
    coll_rows = []
    for sheet_name in COLL_SHEETS:
        if sheet_name not in wb.sheetnames: continue
        ws = wb[sheet_name]
        for row in ws.iter_rows(min_row=2, values_only=True):
            name_raw = cn(row[0]); date_raw = row[1]
            cash_in  = amt(row[2]); online_in = amt(row[3])
            cash_out = amt(row[4]); online_out= amt(row[5])
            
            if not name_raw or not date_raw: continue
            
            base_name = re.sub(r"\([^)]*\)","",name_raw).strip().lower()
            cust_id = name_to_id.get(base_name)
            if not cust_id: continue
            
            coll_date = parse_date(date_raw)
            if not coll_date: continue

            # Create credit entries
            if cash_in and cash_in > 0:
                coll_rows.append((cust_id, BRANCH_ID, cash_in, 'cash', f'Daily collection: {name_raw}', coll_date))
            if online_in and online_in > 0:
                coll_rows.append((cust_id, BRANCH_ID, online_in, 'upi', f'Daily collection: {name_raw}', coll_date))

    if coll_rows:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO collections (customer_id, branch_id, amount, payment_mode, notes, collected_at, created_at)
            VALUES %s
        """, [(c,b,a,m,n,datetime.datetime.fromisoformat(d+"T00:00:00+00:00"),datetime.datetime.now())
              for c,b,a,m,n,d in coll_rows], page_size=500)
        conn.commit()
        print(f"  Inserted {len(coll_rows)} collection records")
    else:
        print("  No collections found (name mismatch)")
else:
    print("  Collections already exist, skipping")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n" + "="*50)
print("ALL DATA IMPORTED!")
cur.close(); conn.close()

