import psycopg2
import os

NEON_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

try:
    cur.execute("SELECT COUNT(*) FROM loans")
    print("Total rows in loans table:", cur.fetchone()[0])
except Exception as e:
    print("Loans table check error:", e)

cur.close()
conn.close()
