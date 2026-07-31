import psycopg2
import os

NEON_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

cur.execute("SELECT count(*) FROM lotteries")
lot_cnt = cur.fetchone()[0]

cur.execute("SELECT installment_amount FROM committees WHERE id = 3")
comm_amt = cur.fetchone()[0]

print(f"Current DB lotteries/winners count: {lot_cnt}")
print(f"Hare Ka Sahara Bissi installment amount in DB: ₹{comm_amt}")

cur.close()
conn.close()
