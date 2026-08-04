import psycopg2
DB = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
conn = psycopg2.connect(DB)
cur = conn.cursor()
cur.execute("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='customers' ORDER BY ordinal_position")
print("customers columns:")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} nullable={r[2]} default={r[3]}")
cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='interest_accounts' ORDER BY ordinal_position")
print("\ninterest_accounts columns:")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} nullable={r[2]}")
cur.execute("SELECT COUNT(*) FROM customers")
print(f"\ncustomers count: {cur.fetchone()[0]}")
cur.execute("SELECT id, name, mobile FROM customers LIMIT 3")
for r in cur.fetchall():
    print(f"  {r}")
conn.close()
