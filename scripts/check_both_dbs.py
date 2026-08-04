import psycopg2

# Check Supabase DB (might be what Render actually uses)
SUPA = "postgresql://postgres.ovtzfzeodcksosfwjibf:BissiAssociation2026@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
NEON = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"

for label, url in [("SUPABASE", SUPA), ("NEON", NEON)]:
    try:
        conn = psycopg2.connect(url, connect_timeout=10)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM daily_diary_loans")
        dl = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM interest_accounts")
        ia = cur.fetchone()[0]
        print(f"{label}: daily_diary_loans={dl}, interest_accounts={ia}")
        cur.execute("SELECT customer_name FROM daily_diary_loans LIMIT 2")
        for r in cur.fetchall(): print(f"  {r[0]}")
        conn.close()
    except Exception as e:
        print(f"{label}: ERROR - {e}")
