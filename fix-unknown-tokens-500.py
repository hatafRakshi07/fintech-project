import psycopg2
import re

DB_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Get Committee ID
cur.execute("SELECT id FROM committees WHERE name LIKE '%Sawariya%5%' ORDER BY id ASC LIMIT 1")
COMMITTEE_ID = cur.fetchone()[0]
BRANCH_ID = 2

print(f"Targeting Committee ID: {COMMITTEE_ID}")

# 1. Update customers with generic/blank names (JSK, blank, null) linked to this committee
cur.execute("""
    SELECT cm.id, cm.token_number, c.id, c.name, c.reference_name
    FROM committee_members cm
    JOIN customers c ON cm.customer_id = c.id
    WHERE cm.committee_id = %s
    ORDER BY cm.joined_at ASC
""", (COMMITTEE_ID,))

rows = cur.fetchall()
unknown_counter = 1
updated_count = 0

for cm_id, token_no, cust_id, cust_name, ref_name in rows:
    c_name_str = (cust_name or "").strip()
    r_name_str = (ref_name or "").strip()
    
    is_placeholder = False
    if not c_name_str or c_name_str.lower() in ("jsk", "none", ""):
        if not r_name_str or r_name_str.lower() in ("jsk", "none", ""):
            is_placeholder = True
    
    if is_placeholder:
        new_name = f"Unknown {unknown_counter}"
        cur.execute("UPDATE customers SET name = %s WHERE id = %s", (new_name, cust_id))
        print(f"  * Token #{token_no}: Renamed to '{new_name}'")
        unknown_counter += 1
        updated_count += 1

# 2. Check all token numbers 1 to 500, insert any missing token (e.g. Token #311)
cur.execute("SELECT token_number FROM committee_members WHERE committee_id = %s", (COMMITTEE_ID,))
existing_tokens = set(r[0] for r in cur.fetchall())

missing_tokens = []
for t in range(1, 501):
    str_t = str(t)
    if str_t not in existing_tokens:
        missing_tokens.append(str_t)

print(f"\nMissing token numbers: {missing_tokens}")

for m_token in missing_tokens:
    u_name = f"Unknown {unknown_counter}"
    unknown_counter += 1
    phone = f"999{int(m_token):07d}"
    ref_num = f"CUST-{phone}"

    # Insert Customer
    cur.execute("""
        INSERT INTO customers (reference_number, name, mobile, branch_id, status, created_at, updated_at)
        VALUES (%s, %s, %s, %s, 'active', NOW(), NOW())
        RETURNING id
    """, (ref_num, u_name, phone, BRANCH_ID))
    cust_id = cur.fetchone()[0]

    # Insert Committee Member
    cur.execute("""
        INSERT INTO committee_members (committee_id, customer_id, token_number, status, joined_at)
        VALUES (%s, %s, %s, 'active', NOW())
    """, (COMMITTEE_ID, cust_id, m_token))

    # Insert Token
    cur.execute("""
        INSERT INTO tokens (token_number, customer_id, committee_id, status, created_at, updated_at)
        VALUES (%s, %s, %s, 'active', NOW(), NOW())
    """, (m_token, cust_id, COMMITTEE_ID))

    print(f"  + Created missing Token #{m_token} as '{u_name}'")

conn.commit()

# Final Verification
cur.execute("SELECT COUNT(*) FROM committee_members WHERE committee_id = %s", (COMMITTEE_ID,))
final_members = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM tokens WHERE committee_id = %s", (COMMITTEE_ID,))
final_tokens = cur.fetchone()[0]

cur.execute("SELECT name, mobile FROM customers WHERE name LIKE 'Unknown%' ORDER BY name ASC")
unknown_list = cur.fetchall()

print("\n=======================================================")
print(f"SUCCESS! FINAL VERIFICATION FOR SAWARIYA SETH 5TH DATE:")
print(f"   * Total Committee Members: {final_members} / 500")
print(f"   * Total Tokens: {final_tokens} / 500")
print(f"   * Total 'Unknown' Members Created/Updated: {len(unknown_list)}")
print("=======================================================")

cur.close()
conn.close()
