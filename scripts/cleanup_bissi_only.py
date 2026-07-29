import sys
import psycopg2

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

NEON_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"

def run_cleanup():
    print("=== STARTING BISSI-ONLY DATA CLEANUP ===")
    conn = psycopg2.connect(NEON_URL)
    cur = conn.cursor()

    # 1. Count before
    cur.execute("SELECT COUNT(*) FROM customers")
    print(f"Customers before: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM collections")
    print(f"Collections before: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM installments")
    print(f"Installments before: {cur.fetchone()[0]}")

    # 2. Delete collections that were imported from collection sheets (not Bissi installments)
    #    These have receipt_number like REC-DAI-, REC-MAN-, REC-AYU-, REC-NIK-, REC-REC-
    cur.execute("""
        DELETE FROM collections
        WHERE receipt_number ILIKE 'REC-DAI-%'
           OR receipt_number ILIKE 'REC-MAN-%'
           OR receipt_number ILIKE 'REC-AYU-%'
           OR receipt_number ILIKE 'REC-NIK-%'
           OR receipt_number ILIKE 'REC-REC-%'
    """)
    print(f"Deleted {cur.rowcount} collection-sheet records")

    # 3. Delete customers added from collection sheets (not from Bissi scheme sheets)
    #    These have reference_number like CUST-COLL-*
    #    But first delete their dependent data
    cur.execute("""
        SELECT id FROM customers WHERE reference_number ILIKE 'CUST-COLL-%'
    """)
    coll_cust_ids = [r[0] for r in cur.fetchall()]
    print(f"Found {len(coll_cust_ids)} customers from collection sheets to remove")

    if coll_cust_ids:
        ids_tuple = tuple(coll_cust_ids)
        cur.execute("DELETE FROM collections WHERE customer_id = ANY(%s)", (coll_cust_ids,))
        print(f"  Deleted {cur.rowcount} collections for those customers")
        cur.execute("DELETE FROM installments WHERE customer_id = ANY(%s)", (coll_cust_ids,))
        print(f"  Deleted {cur.rowcount} installments for those customers")
        cur.execute("DELETE FROM tokens WHERE customer_id = ANY(%s)", (coll_cust_ids,))
        print(f"  Deleted {cur.rowcount} tokens for those customers")
        cur.execute("DELETE FROM committee_members WHERE customer_id = ANY(%s)", (coll_cust_ids,))
        print(f"  Deleted {cur.rowcount} memberships for those customers")
        cur.execute("DELETE FROM customers WHERE id = ANY(%s)", (coll_cust_ids,))
        print(f"  Deleted {cur.rowcount} collection-sheet customers")

    # 4. Delete any loan/interest related data - keep only the 4 bissi committees (id 1,2,3,4)
    cur.execute("""
        DELETE FROM committee_members WHERE committee_id NOT IN (1,2,3,4)
    """)
    print(f"Deleted {cur.rowcount} non-Bissi committee memberships")

    cur.execute("""
        DELETE FROM installments WHERE committee_id NOT IN (1,2,3,4)
    """)
    print(f"Deleted {cur.rowcount} non-Bissi installments")

    cur.execute("""
        DELETE FROM tokens WHERE committee_id NOT IN (1,2,3,4)
    """)
    print(f"Deleted {cur.rowcount} non-Bissi tokens")

    conn.commit()

    # 5. Count after
    cur.execute("SELECT COUNT(*) FROM customers")
    print(f"\nCustomers after: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM collections")
    print(f"Collections after: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM installments")
    print(f"Installments after: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM committee_members")
    print(f"Bissi memberships: {cur.fetchone()[0]}")

    # 6. Show committee member counts per Bissi
    cur.execute("""
        SELECT c.name, COUNT(cm.id) as members
        FROM committees c
        LEFT JOIN committee_members cm ON c.id = cm.committee_id
        WHERE c.id IN (1,2,3,4)
        GROUP BY c.id, c.name
        ORDER BY c.id
    """)
    print("\nBissi-wise member counts:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} members")

    cur.close()
    conn.close()
    print("\n=== CLEANUP COMPLETE ===")

if __name__ == "__main__":
    run_cleanup()
