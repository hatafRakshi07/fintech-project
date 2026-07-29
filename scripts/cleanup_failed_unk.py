import psycopg2, sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
conn = psycopg2.connect("postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require")
cur = conn.cursor()
cur.execute("SELECT id FROM customers WHERE reference_number ILIKE 'UNK-%'")
ids = [r[0] for r in cur.fetchall()]
print(f"Found {len(ids)} Unknown customers from failed run")
if ids:
    cur.execute("DELETE FROM installments WHERE customer_id = ANY(%s)", (ids,))
    print(f"Deleted {cur.rowcount} installments")
    cur.execute("DELETE FROM tokens WHERE customer_id = ANY(%s)", (ids,))
    print(f"Deleted {cur.rowcount} tokens")
    cur.execute("DELETE FROM committee_members WHERE customer_id = ANY(%s)", (ids,))
    print(f"Deleted {cur.rowcount} memberships")
    cur.execute("DELETE FROM customers WHERE id = ANY(%s)", (ids,))
    print(f"Deleted {cur.rowcount} customers")
conn.commit()
cur.close()
conn.close()
print("Cleanup done")
