import psycopg2

SUPABASE_URL = "postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres"

conn = psycopg2.connect(SUPABASE_URL, sslmode="require")
cur = conn.cursor()
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
""")
tables = [r[0] for r in cur.fetchall()]
print("Tables in Supabase public schema:", tables)
cur.close()
conn.close()
