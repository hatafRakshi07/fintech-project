import psycopg2
import os

NEON_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(NEON_URL, connect_timeout=5)
    cur = conn.cursor()

    cur.execute("SELECT committee_id, count(*) FROM tokens GROUP BY committee_id ORDER BY committee_id")
    token_counts = cur.fetchall()

    cur.execute("SELECT count(*) FROM lotteries")
    lot_cnt = cur.fetchone()[0]

    cur.execute("SELECT installment_amount FROM committees WHERE id = 3")
    hare_amt = cur.fetchone()[0]

    print("Token counts per committee:", token_counts)
    print("Total Lotteries/Gifts:", lot_cnt)
    print("Hare Ka Sahara Bissi Installment:", hare_amt)

    cur.close()
    conn.close()
except Exception as e:
    print("Error:", e)
