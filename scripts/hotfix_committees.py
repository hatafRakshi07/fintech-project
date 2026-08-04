"""
Emergency hotfix: add missing `code` column to committees table in Neon DB.
The deployed Render code queries `c.code IN ('BISSI-1',...)` which fails because
the live DB committees table lacks this column.
"""
import psycopg2

DB = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(DB)
conn.autocommit = False
cur = conn.cursor()

print("Checking committees table...")
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='committees' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("Existing columns:", cols)

cur.execute("SELECT id, name FROM committees ORDER BY id LIMIT 10")
rows = cur.fetchall()
print("Committees:", [(str(r[0]), r[1]) for r in rows])

# Step 1: add code column if missing
if 'code' not in cols:
    print("\nAdding 'code' column...")
    cur.execute("ALTER TABLE committees ADD COLUMN IF NOT EXISTS code VARCHAR(50)")
    conn.commit()
    print("  Added.")
else:
    print("'code' already exists.")

# Step 2: add monthly_installment if missing (for scheme-boxes queries)
if 'monthly_installment' not in cols:
    print("Adding 'monthly_installment' column...")
    cur.execute("ALTER TABLE committees ADD COLUMN IF NOT EXISTS monthly_installment NUMERIC(12,2) DEFAULT 3000")
    conn.commit()

# Step 3: populate code and bissi_int_id from known IDs
KNOWN = {
    '11111111-1111-1111-1111-111111111111': ('BISSI-1', 1),
    '22222222-2222-2222-2222-222222222222': ('BISSI-2', 2),
    '33333333-3333-3333-3333-333333333333': ('BISSI-3', 3),
    'a3d68b9c-63df-4884-a5ad-eb8a17e3be31': ('BISSI-4', 4),
}

print("\nPopulating code values...")
for cid, (code, sn) in KNOWN.items():
    cur.execute("""
        UPDATE committees SET code = %s
        WHERE id::text = %s AND (code IS NULL OR code = '')
    """, (code, cid))
    print(f"  {cid[:8]}… → {code}: {cur.rowcount} row(s) updated")

# Also set bissi_int_id if column exists
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='committees' AND column_name='bissi_int_id'")
if cur.fetchone():
    for cid, (code, sn) in KNOWN.items():
        cur.execute("""
            UPDATE committees SET bissi_int_id = %s
            WHERE id::text = %s AND bissi_int_id IS NULL
        """, (sn, cid))

# Also set monthly_installment from installment_amount if it exists
cur.execute("""
    UPDATE committees
    SET monthly_installment = COALESCE(installment_amount, 3000)
    WHERE monthly_installment IS NULL
""")
print(f"  Synced monthly_installment for {cur.rowcount} row(s)")

conn.commit()

# Verify
cur.execute("SELECT id, name, code FROM committees ORDER BY bissi_int_id NULLS LAST LIMIT 10")
print("\nCommittees after fix:")
for r in cur.fetchall():
    print(f"  {str(r[0])[:8]}… | {r[1]} | code={r[2]}")

cur.close()
conn.close()
print("\n✅ Hotfix applied. Committees will load immediately.")
