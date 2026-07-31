import psycopg2
import os

NEON_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

cur.execute("""
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE pg_type.typname = 'token_status'
""")
labels = [r[0] for r in cur.fetchall()]
print("token_status enum values:", labels)
cur.close()
conn.close()
