import psycopg2
DB = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
conn = psycopg2.connect(DB)
cur = conn.cursor()

# Check FK constraints on interest_accounts
cur.execute("""
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'interest_accounts'::regclass
""")
print("interest_accounts constraints:")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} | {r[2]}")

# Check FK constraints on interest_transactions
cur.execute("""
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'interest_transactions'::regclass
""")
print("\ninterest_transactions constraints:")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} | {r[2]}")

# Check what branches exist
cur.execute("SELECT id, name FROM branches LIMIT 5")
print("\nbranches:", cur.fetchall())

# Check daily diary data
cur.execute("SELECT id, customer_name, loan_amount, status FROM daily_diary_loans LIMIT 5")
print("\ndaily_diary_loans:", cur.fetchall())
cur.execute("SELECT COUNT(*) FROM daily_diary_loans")
print("daily_diary_loans count:", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM daily_diary_payments")
print("daily_diary_payments count:", cur.fetchone()[0])

conn.close()
