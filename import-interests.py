"""
Import BYAJ KI LIST (Interest Accounts) → Neon DB
"""
import re, datetime, psycopg2, psycopg2.extras, openpyxl

DB_URL    = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
XLSX_FILE = r"C:\Users\iSN_kota_T52\Downloads\Bissi folder.xlsx"

def clean_name(v):
    if not v: return None
    return str(v).strip()[:200]

def clean_mobile(v):
    if not v: return None
    # Take first number if multiple (e.g. "9461646609/ 8824000548")
    s = re.sub(r"[^\d]", "", str(v).split("/")[0].split(".")[0])
    return s[-10:] if len(s) >= 10 else (s if len(s) >= 6 else None)

def extract_amount(v):
    """Extract first numeric value from possibly complex string."""
    if not v: return None
    s = str(v).replace(",", "")
    m = re.search(r"\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None

print("Connecting to Neon...")
conn = psycopg2.connect(DB_URL)
cur  = conn.cursor()
print("  Connected!\n")

# Get branch
cur.execute("SELECT id FROM branches WHERE code = 'SKA001'")
row = cur.fetchone()
BRANCH_ID = row[0] if row else 4

# Get customer mobile → id map
cur.execute("SELECT id, mobile, name FROM customers WHERE branch_id = %s", (BRANCH_ID,))
mobile_to_id = {}
name_to_id   = {}
for cid, mob, nm in cur.fetchall():
    if mob: mobile_to_id[mob] = cid
    if nm:  name_to_id[nm.lower().strip()] = cid

# Load Excel
print("Reading BYAJ KI LIST...")
wb = openpyxl.load_workbook(XLSX_FILE)
ws = wb["BYAJ KI LIST"]

today = datetime.date.today().isoformat()

accounts = []
skipped  = 0

for row in ws.iter_rows(min_row=2, values_only=True):
    name          = clean_name(row[0])
    mobile        = clean_mobile(row[3])
    interest_date = clean_name(row[5]) or ""
    amount_raw    = row[6]
    monthly_amt   = extract_amount(amount_raw)
    notes_str     = f"Date: {interest_date}" + (f" | Reason: {clean_name(row[8])}" if row[8] else "")

    if not name or name == "None": continue
    if not monthly_amt or monthly_amt <= 0: continue

    # Resolve customer id
    cust_id = mobile_to_id.get(mobile) if mobile else None
    if not cust_id:
        # Try name match (strip reference number in brackets)
        base_name = re.sub(r"\([^)]*\)", "", name).strip().lower()
        cust_id = name_to_id.get(base_name)

    if not cust_id:
        skipped += 1
        continue

    # principal_amount: store monthly_interest * 50 as rough estimate if unknown
    # Rate default: 2% per month → principal = monthly_amt / 2 * 100
    principal = round(monthly_amt * 50, 2)

    accounts.append((
        cust_id, str(principal), "2.00", today,
        str(monthly_amt), "0", "0",  # monthlyInterest, totalPaid, pending
        "active", BRANCH_ID, notes_str
    ))

print(f"  Found {len(accounts)} valid interest accounts ({skipped} skipped - no customer match)")

# Check existing
cur.execute("SELECT COUNT(*) FROM interest_accounts WHERE branch_id = %s", (BRANCH_ID,))
existing = cur.fetchone()[0]
if existing > 0:
    print(f"  {existing} accounts already exist, skipping insert")
else:
    psycopg2.extras.execute_values(cur, """
        INSERT INTO interest_accounts
          (customer_id, principal_amount, interest_rate, start_date,
           monthly_interest, total_interest_paid, pending_interest,
           status, branch_id, notes, created_at, updated_at)
        VALUES %s
    """, [(c,p,r,sd,mi,tp,pi,st,b,n,datetime.datetime.now(),datetime.datetime.now())
          for c,p,r,sd,mi,tp,pi,st,b,n in accounts],
    page_size=100)
    conn.commit()
    print(f"  Inserted {len(accounts)} interest accounts")

print("\n" + "="*50)
print(f"DONE! {len(accounts)} interest accounts imported")
print("Open app -> Interests to see them")
print("="*50)

cur.close(); conn.close()
