import psycopg2
import os

NEON_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

cur.execute("SELECT count(*) FROM collections")
col_cnt = cur.fetchone()[0]

cur.execute("SELECT count(*) FROM installments")
inst_cnt = cur.fetchone()[0]

cur.execute("SELECT count(*) FROM customers")
cust_cnt = cur.fetchone()[0]

print(f"Current DB stats - Customers: {cust_cnt}, Collections: {col_cnt}, Installments: {inst_cnt}")

cur.close()
conn.close()
