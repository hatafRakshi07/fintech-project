import psycopg2, sys, calendar
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

conn = psycopg2.connect("postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()

print("=" * 60)
print("    SHREE KRISHNA ASSOCIATION — PURA HISAAB")
print("=" * 60)

# ── Overall ──────────────────────────────────────────────────
cur.execute("SELECT COUNT(*) FROM customers")
total_cust = cur.fetchone()[0]

cur.execute("SELECT COUNT(DISTINCT customer_id) FROM committee_members WHERE committee_id IN (1,2,3,4)")
bissi_cust = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM installments WHERE committee_id IN (1,2,3,4)")
total_inst = cur.fetchone()[0]

cur.execute("SELECT COALESCE(SUM(amount),0) FROM installments WHERE committee_id IN (1,2,3,4)")
total_inst_amt = float(cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM collections")
total_coll = cur.fetchone()[0]

cur.execute("SELECT COALESCE(SUM(amount),0) FROM collections")
total_coll_amt = float(cur.fetchone()[0])

print(f"\n📦 OVERALL DATABASE")
print(f"   Total Customers          : {total_cust:,}")
print(f"   Bissi Members (unique)   : {bissi_cust:,}")
print(f"   Total Installments       : {total_inst:,}")
print(f"   Total Installment Amount : ₹{total_inst_amt:,.0f}")
print(f"   Total Collections        : {total_coll:,}")
print(f"   Total Collection Amount  : ₹{total_coll_amt:,.0f}")
print(f"   GRAND TOTAL RECEIVED     : ₹{(total_inst_amt + total_coll_amt):,.0f}")

# ── Per Bissi ─────────────────────────────────────────────────
print(f"\n{'─'*60}")
print("📋 PER BISSI BREAKDOWN")
print(f"{'─'*60}")

bissi_list = [
    (1, "Sawariya Seth Bissi"),
    (2, "Pyare Mohan Bissi"),
    (3, "Hare Ka Sahara Bissi"),
    (4, "Shree Krishna Bissi"),
]

for cid, bname in bissi_list:
    cur.execute("SELECT COUNT(DISTINCT customer_id) FROM committee_members WHERE committee_id = %s", (cid,))
    uniq = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM committee_members WHERE committee_id = %s", (cid,))
    tokens = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM customers WHERE name ILIKE 'Unknown%%' AND id IN (SELECT customer_id FROM committee_members WHERE committee_id = %s)", (cid,))
    unknowns = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*), COALESCE(SUM(amount),0) FROM installments WHERE committee_id = %s", (cid,))
    inst_cnt, inst_amt = cur.fetchone()
    inst_amt = float(inst_amt)

    print(f"\n  🔵 {bname}")
    print(f"     Unique Customers    : {uniq:,}")
    print(f"     Total Tokens        : {tokens:,}")
    print(f"     Unknown Customers   : {unknowns:,}")
    print(f"     Installments Count  : {inst_cnt:,}")
    print(f"     Total Amount Paid   : ₹{inst_amt:,.0f}")

# ── Collections breakdown ─────────────────────────────────────
print(f"\n{'─'*60}")
print(f"📥 COLLECTIONS (Manual Entries by Mode)")
cur.execute("""
    SELECT COALESCE(payment_mode::text,'unknown'), COUNT(*), COALESCE(SUM(amount),0)
    FROM collections GROUP BY payment_mode ORDER BY SUM(amount) DESC
""")
for mode, cnt, total in cur.fetchall():
    print(f"   {mode:<12} : {cnt:>5} entries  =  ₹{float(total):>12,.0f}")

# ── Unknown customers ─────────────────────────────────────────
cur.execute("SELECT COUNT(*) FROM customers WHERE name ILIKE 'Unknown%%'")
unk = cur.fetchone()[0]
print(f"\n👻 Unknown Customers (blank name in Excel) : {unk:,}")

# ── Monthly trend ─────────────────────────────────────────────
print(f"\n{'─'*60}")
print("📅 MONTH-WISE INSTALLMENTS (latest months first)")
cur.execute("""
    SELECT year, month, COUNT(*) as cnt, COALESCE(SUM(amount),0) as total
    FROM installments
    WHERE year BETWEEN 2023 AND 2027
    GROUP BY year, month
    ORDER BY year DESC, month DESC
    LIMIT 18
""")
for y, mo, cnt, total in cur.fetchall():
    mon_name = calendar.month_abbr[mo]
    print(f"   {mon_name} {y}  →  {cnt:>5} installments  =  ₹{float(total):>12,.0f}")

cur.close()
conn.close()
print("\n" + "=" * 60)
