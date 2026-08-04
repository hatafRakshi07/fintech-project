import psycopg2
DB = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
conn = psycopg2.connect(DB)
cur = conn.cursor()
cur.execute("SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid GROUP BY typname ORDER BY typname")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1]}")
conn.close()
