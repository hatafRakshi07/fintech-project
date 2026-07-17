"""
import os
Import ALL remaining data:
1. Loan payments (nikku ji loan)
2. Recovery/pending amounts (other pending amounts)
3. Monthly installments  
4. Update customer addresses from bissi sheets
"""
import os
import re, datetime, psycopg2, psycopg2.extras, openpyxl

DB_URL    = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
XLSX_FILE = os.path.join(os.path.expanduser("~"), "Downloads", "Bissi folder.xlsx")

def cn(v): return str(v).strip()[:500] if v and str(v).strip() not in ('None','nan','') else None
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

cur.execute("SELECT id FROM branches WHERE code='SKA001'")
BRANCH_ID = cur.fetchone()[0]
today = datetime.date.today().isoformat()

# Build customer lookup
cur.execute("SELECT id, mobile, name, address FROM customers WHERE branch_id=%s", (BRANCH_ID,))
mob_to_id = {}; name_to_id = {}; cust_address = {}
for cid, m, n, addr in cur.fetchall():
    if m: mob_to_id[m] = cid
    if n:
        name_to_id[re.sub(r"\([^)]*\)","",n).strip().lower()] = cid
        name_to_id[n.lower().strip()] = cid
    if addr: cust_address[cid] = addr

wb = openpyxl.load_workbook(XLSX_FILE)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 1. UPDATE CUSTOMER ADDRESSES from all bissi sheets
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("--- Updating customer addresses ---")
SHEETS_WITH_ADDR = [
    ('Sawariya seth 5 date',           1, 3, 5),   # col_name, col_mob, col_addr
    ('Pyare mohan 15 date',            1, 3, 6),
    ('Hare ka sahara bissi 20 date',   1, 3, 4),
    ('Shree Krishna associate lottery',1, 3, 5),
]
addr_updates = {}
for sn, cn_col, cm_col, ca_col in SHEETS_WITH_ADDR:
    ws = wb[sn]
    for row in ws.iter_rows(min_row=2, values_only=True):
        mobile = mob(row[cm_col] if len(row)>cm_col else None)
        address = cn(row[ca_col] if len(row)>ca_col else None)
        if not address: continue
        cid = mob_to_id.get(mobile) if mobile else None
        if cid and not cust_address.get(cid):
            addr_updates[cid] = address

if addr_updates:
    for cid, addr in addr_updates.items():
        cur.execute("UPDATE customers SET address=%s, updated_at=NOW() WHERE id=%s", (addr, cid))
    conn.commit()
    print(f"  Updated addresses for {len(addr_updates)} customers")
else:
    print("  No new addresses to update")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 2. LOAN RECORDS (nikku ji loan â€” debit = loan disbursed)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n--- Loan records (nikku ji loan) ---")
ws = wb['nikku ji loan']
cur.execute("SELECT COUNT(*) FROM loans WHERE branch_id=%s", (BRANCH_ID,))
loan_count = cur.fetchone()[0]

if loan_count == 0:
    loan_rows = []
    seen = set()
    for row in ws.iter_rows(min_row=2, values_only=True):
        name_raw = cn(row[0]); loan_amt = amt(row[6])
        if not name_raw or not loan_amt or loan_amt <= 0: continue
        base = re.sub(r"\([^)]*\)","",name_raw).strip().lower()
        cid = name_to_id.get(base)
        if not cid: continue
        key = (cid, loan_amt)
        if key in seen: continue
        seen.add(key)
        loan_rows.append((cid, str(loan_amt), "flat", "2.00", 12,
                         today, "active", BRANCH_ID,
                         f"Imported from Excel: {name_raw}"))

    if loan_rows:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO loans (customer_id, principal_amount, interest_type, interest_rate,
                               tenure, due_date, status, branch_id, purpose,
                               created_at, updated_at)
            VALUES %s
        """, [(c,p,it,ir,tm,nd,st,b,n,datetime.datetime.now(),datetime.datetime.now())
              for c,p,it,ir,tm,nd,st,b,n in loan_rows], page_size=50)
        conn.commit()
        print(f"  Inserted {len(loan_rows)} loan records")
    else:
        print("  No loans found")
else:
    print(f"  {loan_count} loans already exist, skipping")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 3. RECOVERY TASKS (other pending amounts)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n--- Recovery tasks (other pending amounts) ---")
ws = wb['other pending amounts']
cur.execute("SELECT COUNT(*) FROM recovery_tasks WHERE branch_id=%s", (BRANCH_ID,))
rec_count = cur.fetchone()[0]

if rec_count == 0:
    rec_rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        name_raw = cn(row[0]); pending_amt = amt(row[1])
        mobile_raw = mob(row[2]); reason = cn(row[5])
        if not name_raw: continue
        base = re.sub(r"\([^)]*\)","",name_raw).strip().lower()
        cid = name_to_id.get(base) or mob_to_id.get(mobile_raw or "")
        if not cid:
            # Create a simple note without customer link
            continue
        rec_rows.append((cid, BRANCH_ID, "pending", "medium",
                        str(pending_amt or 0), reason or name_raw,
                        today))

    if rec_rows:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO recovery_tasks (customer_id, branch_id, status, priority,
                                        overdue_amount, notes, due_date, created_at, updated_at)
            VALUES %s
        """, [(c,b,st,pr,pa,n,dd,datetime.datetime.now(),datetime.datetime.now())
              for c,b,st,pr,pa,n,dd in rec_rows], page_size=50)
        conn.commit()
        print(f"  Inserted {len(rec_rows)} recovery tasks")
    else:
        print("  No recovery tasks (no customer match)")
else:
    print(f"  {rec_count} recovery tasks already exist, skipping")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 4. MONTHLY INSTALLMENT collections
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
print("\n--- Monthly installments ---")
ws = wb['MONTHLY INSTALLMENT']
coll_rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    name_raw = cn(row[0]); mobile_raw = mob(row[1])
    inst_amt  = amt(row[4]); reason = cn(row[5])
    if not name_raw or not inst_amt: continue
    base = re.sub(r"\([^)]*\)","",name_raw).strip().lower()
    cid = name_to_id.get(base) or mob_to_id.get(mobile_raw or "")
    if not cid: continue
    coll_rows.append((cid, BRANCH_ID, inst_amt, "cash",
                     f"Monthly installment: {name_raw}" + (f" | {reason}" if reason else ""),
                     today))

if coll_rows:
    psycopg2.extras.execute_values(cur, """
        INSERT INTO collections (customer_id, branch_id, amount, payment_mode, notes,
                                 collected_at, created_at)
        VALUES %s
    """, [(c,b,a,m,n,datetime.datetime.fromisoformat(d+"T00:00:00+00:00"),datetime.datetime.now())
          for c,b,a,m,n,d in coll_rows], page_size=50)
    conn.commit()
    print(f"  Inserted {len(coll_rows)} monthly installment records")
else:
    print("  No monthly installments found")

print("\n" + "="*50)
print("ALL REMAINING DATA IMPORTED!")
print(f"  Addresses updated: {len(addr_updates)}")
print("="*50)
cur.close(); conn.close()

