import psycopg2

conn = psycopg2.connect('postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres', sslmode='require')
cur = conn.cursor()

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers'")
print('customers columns:', cur.fetchall())

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'memberships'")
print('memberships columns:', cur.fetchall())

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payment_receipts'")
print('payment_receipts columns:', cur.fetchall())
