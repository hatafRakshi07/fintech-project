import psycopg2
import os

NEON_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

cur.execute("""
    SELECT 
        cm.token_number as "tokenNumber",
        c.name as "committeeName",
        c.installment_amount as "installmentAmount",
        cust.name as "customerName",
        cust.mobile as "customerMobile",
        cust.reference_number as "referenceNumber"
    FROM committee_members cm
    JOIN committees c ON c.id = cm.committee_id
    JOIN customers cust ON cust.id = cm.customer_id
    WHERE cm.status = 'active'
    ORDER BY c.id ASC, cm.token_number ASC
    LIMIT 10
""")
rows = cur.fetchall()
print("Pending report query returned rows:", len(rows))
if rows:
    print("Sample row:", rows[0])

cur.close()
conn.close()
