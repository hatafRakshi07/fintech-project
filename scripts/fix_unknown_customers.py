import openpyxl, psycopg2, psycopg2.extras, sys, re
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

NEON_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
EXCEL_PATH = r"C:\Users\iSN_kota_T52\Downloads\Bissi folder.xlsx"

def parse_date(val):
    if not val: return datetime.now()
    if isinstance(val, datetime): return val
    from datetime import date as date_
    if isinstance(val, date_): return datetime(val.year, val.month, val.day)
    s = str(val).strip()
    parts = re.split(r"[/-]", s)
    if len(parts) == 3:
        try:
            d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
            if y < 100: y += 2000
            return datetime(y, m, d)
        except: pass
    return datetime.now()

conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

# Pre-load existing tokens (token_number, committee_id) to avoid duplicates
cur.execute("SELECT token_number, committee_id FROM tokens")
existing_tokens = {(str(r[0]), r[1]) for r in cur.fetchall()}

scheme_sheets = [
    ("Sawariya seth 5 date", 1, 3000.0),
    ("Pyare mohan 15 date", 2, 3000.0),
    ("Hare ka sahara bissi 20 date", 3, 2500.0),
    ("Shree Krishna associate lottery", 4, 3000.0)
]

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)

new_customers = []   # (ref_num, name, mobile, ref_name, address)
token_inserts = []   # (token_number, customer_id, committee_id, status)
membership_inserts = []  # (committee_id, customer_id, token_number, status)
installment_inserts = []  # (customer_id, token_id_placeholder, committee_id, month, year, amount, payment_date, payment_mode, remarks)

# Per-sheet rows to process after bulk insert
deferred_rows = []  # (sh_name, c_id, default_amount, raw_token, ref, month_cols_data)

unknown_counter = [1]  # mutable for nested use

print("=== INSERTING BLANK-NAME CUSTOMERS WITH REFERENCE DATA ===")

for sh_name, c_id, default_amt in scheme_sheets:
    ws = wb[sh_name]
    rows = [r for r in ws.iter_rows(values_only=True) if r and any(x is not None for x in r)]
    if not rows: continue

    header_row = rows[0]
    month_cols = []
    for idx in range(6, len(header_row)):
        val = header_row[idx]
        if val is not None:
            month_cols.append((idx, val, parse_date(val)))

    for r in rows[1:]:
        token = str(r[0]).strip().split(".")[0] if r[0] else ""
        if not token.isdigit(): continue
        name = str(r[1]).strip() if r[1] else ""
        ref  = str(r[2]).strip() if r[2] else ""
        has_payment = any(
            r[i] is not None and str(r[i]).strip() not in ("", "None")
            for i in range(7, min(15, len(r)))
        )

        # Skip if name already exists or no data
        if name and name.lower() not in ("none", ""):
            continue
        if not (ref or has_payment):
            continue
        # Skip if token already exists in DB
        if (token, c_id) in existing_tokens:
            continue

        clean_ref = ref.strip() if ref and ref.lower() not in ("none", "", "jsk", "-") else ""
        new_name = f"Unknown ({clean_ref})" if clean_ref else f"Unknown {unknown_counter[0]}"
        unknown_counter[0] += 1

        ref_num = f"UNK-{c_id}-{token}"
        mobile = f"9990{c_id:01d}{int(token):05d}"

        new_customers.append((ref_num, new_name, mobile, clean_ref or None, "", c_id, token, month_cols, list(r), default_amt))
        existing_tokens.add((token, c_id))  # prevent re-processing

# Bulk insert customers
if new_customers:
    cust_vals = [(x[0], x[1], x[2], x[3], x[4]) for x in new_customers]
    inserted = psycopg2.extras.execute_values(
        cur,
        """INSERT INTO customers (reference_number, name, mobile, reference_name, address, branch_id, status, created_at, updated_at)
           VALUES %s
           RETURNING id, reference_number""",
        [(rv, nm, mob, rn, addr, 1, 'active', datetime.now(), datetime.now()) for rv, nm, mob, rn, addr, cid, tok, mc, row, da in new_customers],
        page_size=500,
        fetch=True
    )
    ref_to_id = {ref: cid for cid, ref in inserted}
    print(f"Inserted {len(inserted)} new Unknown customers")

    # Build tokens + memberships + installments
    tok_batch = []
    mem_batch = []
    inst_batch = []

    for ref_num, new_name, mobile, clean_ref, addr, c_id, token, month_cols, row, default_amt in new_customers:
        cust_id = ref_to_id.get(ref_num)
        if not cust_id: continue

        tok_batch.append((token, cust_id, c_id, 'active', datetime.now(), datetime.now()))
        mem_batch.append((c_id, cust_id, token, 'active', datetime.now()))

        for col_idx, raw_col_header, m_date in month_cols:
            if col_idx < len(row):
                cell_val = str(row[col_idx]).strip() if row[col_idx] is not None else ""
                if cell_val and cell_val.lower() not in ("none", "-", ""):
                    clean_num = re.sub(r"[^\d.]", "", cell_val)
                    try:
                        amount = float(clean_num) if clean_num and clean_num != "." else default_amt
                    except: amount = default_amt
                    if 0 < amount <= 100000:
                        inst_batch.append((cust_id, None, c_id, m_date.month, m_date.year, amount, m_date, 'cash', f"Installment {raw_col_header}", datetime.now()))

    if tok_batch:
        inserted_toks = psycopg2.extras.execute_values(
            cur,
            "INSERT INTO tokens (token_number, customer_id, committee_id, status, created_at, updated_at) VALUES %s RETURNING id, customer_id, committee_id",
            tok_batch, page_size=500, fetch=True
        )
        # Build map (customer_id, committee_id) -> token_id
        tok_id_map = {(r[1], r[2]): r[0] for r in inserted_toks}
        print(f"Inserted {len(tok_batch)} tokens")
    else:
        tok_id_map = {}

    if mem_batch:
        psycopg2.extras.execute_values(cur, "INSERT INTO committee_members (committee_id, customer_id, token_number, status, joined_at) VALUES %s", mem_batch, page_size=500)
        print(f"Inserted {len(mem_batch)} memberships")

    if inst_batch:
        # Replace None token_id with actual token_id from tok_id_map
        resolved_inst = []
        for (cust_id, _, c_id, month, year, amount, p_date, mode, remarks, created) in inst_batch:
            tok_id = tok_id_map.get((cust_id, c_id))
            if tok_id:
                resolved_inst.append((cust_id, tok_id, c_id, month, year, amount, p_date, mode, remarks, created))
        psycopg2.extras.execute_values(
            cur,
            "INSERT INTO installments (customer_id, token_id, committee_id, month, year, amount, payment_date, payment_mode, remarks, created_at) VALUES %s",
            resolved_inst, page_size=500
        )
        print(f"Inserted {len(resolved_inst)} installments")

    conn.commit()

else:
    print("No blank-name rows to insert (all already in DB)")

cur.close()
conn.close()
print("=== DONE ===")
