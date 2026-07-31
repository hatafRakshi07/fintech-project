import psycopg2
import os

NEON_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

cur.execute("SELECT committee_id, count(*) FROM tokens GROUP BY committee_id ORDER BY committee_id")
token_counts = cur.fetchall()

cur.execute("SELECT count(*) FROM lotteries")
lot_cnt = cur.fetchone()[0]

print("Token counts per committee (strictly 500, 500, 500, 1111):", token_counts)
print("Total Gift & Winner records imported:", lot_cnt)

cur.close()
conn.close()
