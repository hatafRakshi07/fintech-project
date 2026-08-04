import psycopg2
DB = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
conn = psycopg2.connect(DB)
cur = conn.cursor()

cur.execute("SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('daily_diary_loans','daily_diary_payments','interest_accounts')")
print("RLS:", cur.fetchall())

cur.execute("SELECT id, customer_name, status, created_at FROM daily_diary_loans ORDER BY created_at DESC LIMIT 5")
print("Loans:")
for r in cur.fetchall():
    print(f"  {r[1]} | {r[2]} | {r[3]}")

cur.execute("SELECT COUNT(*) FROM daily_diary_loans WHERE status IN ('ACTIVE','COMPLETED','active','completed')")
print("Active/Completed count:", cur.fetchone()[0])

conn.close()
