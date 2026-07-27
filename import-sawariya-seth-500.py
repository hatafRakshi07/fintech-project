import os
import re
import csv
import psycopg2
import psycopg2.extras
from datetime import datetime

DB_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
FOLDER_PATH = r"C:\Users\iSN_kota_T52\Downloads\sawariya seth 5 date"

FILE_MAIN = os.path.join(FOLDER_PATH, "Bissi folder - Sawariya seth 5 date.csv")
FILE_GIFTS_SHEET = os.path.join(FOLDER_PATH, "Bissi folder - Sawariya bissi 5 date gift sheets.csv")
FILE_GIFT_RECORD = os.path.join(FOLDER_PATH, "Bissi folder - Sawariya seth bissi gift record.csv")

def clean_mobile(val):
    if not val:
        return None
    s = re.sub(r"[^\d]", "", str(val).split(".")[0])
    s = s[-10:] if len(s) >= 10 else s
    return s if len(s) >= 6 else None

def clean_name(val):
    if not val:
        return None
    v = str(val).strip()
    return v[:200] if v and v.lower() not in ("none", "name", "name ", "") else None

print("Connecting to Neon PostgreSQL...")
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
print("  Connected successfully!\n")

# 1. Ensure Branch
cur.execute("SELECT id FROM branches WHERE code = 'SKA001' OR name LIKE '%Shree Krishna%' LIMIT 1")
row = cur.fetchone()
if row:
    BRANCH_ID = row[0]
else:
    cur.execute("""
        INSERT INTO branches (name, code, city, status, created_at, updated_at)
        VALUES ('Shree Krishna Associate', 'SKA001', 'Jaipur', 'active', NOW(), NOW())
        RETURNING id
    """)
    BRANCH_ID = cur.fetchone()[0]
    conn.commit()

# 2. Ensure Committee: Sawariya Seth Bissi (5th Date)
COMMITTEE_NAME = "Sawariya Seth Bissi (5th Date)"

cur.execute("SELECT id FROM committees WHERE name LIKE '%Sawariya%5%' ORDER BY id ASC LIMIT 1")
row = cur.fetchone()
if row:
    COMMITTEE_ID = row[0]
    print(f"Using existing Committee ID: {COMMITTEE_ID} for '{COMMITTEE_NAME}'")
else:
    cur.execute("""
        INSERT INTO committees (
            name, type, installment_amount, member_limit, draw_date,
            duration, status, branch_id, created_at, updated_at
        ) VALUES (
            %s, 'monthly', 3000.00, 500, '2025-11-05',
            20, 'active', %s, NOW(), NOW()
        ) RETURNING id
    """, (COMMITTEE_NAME, BRANCH_ID))
    COMMITTEE_ID = cur.fetchone()[0]
    conn.commit()

token_to_customer = {}
processed_tokens = set()
unknown_counter = 1

# 3. Read Main Bissi CSV File
print("\n[1/3] Processing Main Members & Collections File (Including Unknowns)...")
with open(FILE_MAIN, mode="r", encoding="utf-8-sig", errors="replace") as f:
    reader = csv.reader(f)
    headers = [h.strip() for h in next(reader)]
    
    month_columns = []
    for idx, h in enumerate(headers):
        if idx >= 7 and h:
            month_columns.append((idx, h))

    imported_members = 0
    imported_collections = 0

    for row in reader:
        if not row or len(row) < 1:
            continue
        
        raw_token = row[0].strip() if len(row) > 0 else ""
        if not raw_token:
            continue

        raw_name = clean_name(row[1]) if len(row) > 1 else None
        raw_ref_name = clean_name(row[2]) if len(row) > 2 else None
        raw_mobile = clean_mobile(row[3]) if len(row) > 3 else None
        raw_ref_mobile = clean_mobile(row[4]) if len(row) > 4 else None
        raw_address = row[5].strip() if len(row) > 5 else ""

        # Handle empty/blank name or placeholder "jsk"
        if not raw_name or raw_name.lower() in ("jsk", "none", ""):
            if raw_ref_name and raw_ref_name.lower() not in ("jsk", "none", ""):
                raw_name = raw_ref_name
            else:
                raw_name = f"Unknown {unknown_counter}"
                unknown_counter += 1

        phone = raw_mobile or raw_ref_mobile
        if not phone:
            phone = f"999{int(raw_token):07d}" if raw_token.isdigit() else f"999{abs(hash(raw_name)) % 10000000:07d}"

        ref_num = f"CUST-{phone}"
        cur.execute("SELECT id FROM customers WHERE mobile = %s OR reference_number = %s LIMIT 1", (phone, ref_num))
        cust_row = cur.fetchone()
        if cust_row:
            cust_id = cust_row[0]
            # Update name if previously generic
            cur.execute("UPDATE customers SET name = %s WHERE id = %s AND (name IS NULL OR name LIKE 'Unknown%%' OR name ILIKE 'jsk')", (raw_name, cust_id))
        else:
            cur.execute("""
                INSERT INTO customers (
                    reference_number, name, mobile, alternate_mobile, address, reference_name, branch_id, status, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, 'active', NOW(), NOW()
                ) RETURNING id
            """, (ref_num, raw_name, phone, raw_ref_mobile, raw_address, raw_ref_name, BRANCH_ID))
            cust_id = cur.fetchone()[0]

        # Insert/Update Committee Member
        cur.execute("""
            SELECT id FROM committee_members 
            WHERE committee_id = %s AND token_number = %s
            LIMIT 1
        """, (COMMITTEE_ID, raw_token))
        mem_row = cur.fetchone()
        if not mem_row:
            cur.execute("""
                INSERT INTO committee_members (committee_id, customer_id, token_number, status, joined_at)
                VALUES (%s, %s, %s, 'active', NOW())
            """, (COMMITTEE_ID, cust_id, raw_token))

        # Insert/Update Token
        cur.execute("""
            SELECT id FROM tokens 
            WHERE committee_id = %s AND token_number = %s
            LIMIT 1
        """, (COMMITTEE_ID, raw_token))
        tok_row = cur.fetchone()
        if not tok_row:
            cur.execute("""
                INSERT INTO tokens (token_number, customer_id, committee_id, status, created_at, updated_at)
                VALUES (%s, %s, %s, 'active', NOW(), NOW())
            """, (raw_token, cust_id, COMMITTEE_ID))

        token_to_customer[raw_token] = cust_id
        processed_tokens.add(raw_token)
        imported_members += 1

        # Process Month Collections
        for col_idx, col_name in month_columns:
            if col_idx < len(row):
                cell_val = row[col_idx].strip()
                if not cell_val:
                    continue
                
                clean_num = re.sub(r"[^\d.]", "", cell_val)
                amount = float(clean_num) if clean_num else 3000.0

                cur.execute("""
                    INSERT INTO collections (
                        customer_id, branch_id, committee_id, amount, payment_mode, notes,
                        collected_at, created_at, verification_status
                    ) VALUES (
                        %s, %s, %s, %s, 'cash', %s, NOW(), NOW(), 'verified'
                    )
                """, (cust_id, BRANCH_ID, COMMITTEE_ID, amount, f"Bissi Token #{raw_token} - Month {col_name} ({cell_val})"))
                imported_collections += 1

# Fill any missing token numbers up to 500 (e.g. Token #311)
print("\nFilling any remaining uncreated tokens (1 to 500)...")
for t_num in range(1, 501):
    str_t = str(t_num)
    if str_t not in processed_tokens:
        u_name = f"Unknown {unknown_counter}"
        unknown_counter += 1
        phone = f"999{t_num:07d}"
        ref_num = f"CUST-{phone}"

        cur.execute("SELECT id FROM customers WHERE mobile = %s LIMIT 1", (phone,))
        cust_row = cur.fetchone()
        if cust_row:
            cust_id = cust_row[0]
        else:
            cur.execute("""
                INSERT INTO customers (
                    reference_number, name, mobile, branch_id, status, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, 'active', NOW(), NOW())
                RETURNING id
            """, (ref_num, u_name, phone, BRANCH_ID))
            cust_id = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO committee_members (committee_id, customer_id, token_number, status, joined_at)
            VALUES (%s, %s, %s, 'active', NOW())
            ON CONFLICT DO NOTHING
        """, (COMMITTEE_ID, cust_id, str_t))

        cur.execute("""
            INSERT INTO tokens (token_number, customer_id, committee_id, status, created_at, updated_at)
            VALUES (%s, %s, %s, 'active', NOW(), NOW())
            ON CONFLICT DO NOTHING
        """, (str_t, cust_id, COMMITTEE_ID))

        token_to_customer[str_t] = cust_id
        processed_tokens.add(str_t)
        print(f"  + Added missing Token #{str_t} as {u_name}")

conn.commit()

# Query final count
cur.execute("SELECT COUNT(*) FROM committee_members WHERE committee_id = %s", (COMMITTEE_ID,))
final_member_count = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM tokens WHERE committee_id = %s", (COMMITTEE_ID,))
final_token_count = cur.fetchone()[0]

print("\n=======================================================")
print(f"🎉 SUCCESS! Sawariya Seth Bissi Final Members: {final_member_count} / 500")
print(f"🎉 Total Tokens: {final_token_count} / 500")
print("=======================================================")

cur.close()
conn.close()
