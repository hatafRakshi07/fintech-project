import psycopg2
DB = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
conn = psycopg2.connect(DB)
cur = conn.cursor()

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
print("Tables:", [r[0] for r in cur.fetchall()])

for t in ['interest_accounts', 'interest_transactions', 'daily_diary_loans', 'daily_diary_payments']:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position", (t,))
    rows = cur.fetchall()
    if rows:
        print(f"\n{t}: {[r[0] for r in rows]}")
    else:
        print(f"\n{t}: NOT FOUND")

conn.close()
