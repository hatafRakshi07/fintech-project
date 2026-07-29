import psycopg2, sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

conn = psycopg2.connect("postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()

bissi = [(1, "Sawariya Seth", 500), (2, "Pyare Mohan", 500), (3, "Hare Ka Sahara", 500), (4, "Shree Krishna", 1111)]

print("=" * 65)
print("  TOKEN SLOT ANALYSIS (Unique token numbers per Bissi)")
print("=" * 65)

for cid, name, max_tokens in bissi:
    # Unique token numbers
    cur.execute("SELECT COUNT(DISTINCT token_number) FROM tokens WHERE committee_id = %s", (cid,))
    unique_token_nums = cur.fetchone()[0]

    # Total rows (including any duplicates)
    cur.execute("SELECT COUNT(*) FROM tokens WHERE committee_id = %s", (cid,))
    total_rows = cur.fetchone()[0]

    # Customers with multiple tokens (holding >1 slot in this bissi)
    cur.execute("""
        SELECT customer_id, COUNT(*) as cnt
        FROM tokens WHERE committee_id = %s
        GROUP BY customer_id
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC LIMIT 5
    """, (cid,))
    multi = cur.fetchall()

    # Duplicate token_number entries (same token assigned to >1 customer)
    cur.execute("""
        SELECT token_number, COUNT(*) as cnt
        FROM tokens WHERE committee_id = %s
        GROUP BY token_number
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC LIMIT 5
    """, (cid,))
    dup_tokens = cur.fetchall()

    # committee_members duplicates
    cur.execute("SELECT COUNT(*) FROM committee_members WHERE committee_id = %s", (cid,))
    mem_rows = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM committee_members WHERE committee_id = %s AND (token_number, customer_id) IN (SELECT token_number, customer_id FROM committee_members WHERE committee_id = %s GROUP BY token_number, customer_id HAVING COUNT(*) > 1)", (cid, cid))
    dup_mems = cur.fetchone()[0]

    print(f"\n🔵 {name} (max slots: {max_tokens})")
    print(f"   Unique token numbers  : {unique_token_nums:>5}  (out of {max_tokens})")
    print(f"   Total token rows      : {total_rows:>5}")
    print(f"   Committee_members rows: {mem_rows:>5}")
    print(f"   Duplicate memberships : {dup_mems:>5}")
    if dup_tokens:
        print(f"   ⚠️  Duplicate token numbers (same slot, 2 customers):")
        for t, c in dup_tokens:
            print(f"      Token {t} → {c} rows")
    if multi:
        print(f"   👤 Customers with multiple slots (top 5):")
        for cust, cnt in multi:
            cur.execute("SELECT name FROM customers WHERE id = %s", (cust,))
            r = cur.fetchone()
            cname = r[0] if r else "?"
            print(f"      {cname[:30]:<30} → {cnt} tokens")

cur.close()
conn.close()
print("\n" + "=" * 65)
