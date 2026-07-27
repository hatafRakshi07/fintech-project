import os
import re
import csv
import psycopg2

DB_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
FOLDER_PATH = r"C:\Users\iSN_kota_T52\Downloads\sawariya seth 5 date"

FILE_MAIN = os.path.join(FOLDER_PATH, "Bissi folder - Sawariya seth 5 date.csv")
FILE_GIFTS_SHEET = os.path.join(FOLDER_PATH, "Bissi folder - Sawariya bissi 5 date gift sheets.csv")
FILE_GIFT_RECORD = os.path.join(FOLDER_PATH, "Bissi folder - Sawariya seth bissi gift record.csv")

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Get Committee ID for Sawariya Seth Bissi (5th Date)
cur.execute("SELECT id FROM committees WHERE name LIKE '%Sawariya%5%' ORDER BY id ASC LIMIT 1")
row = cur.fetchone()
if not row:
    print("Error: Committee not found")
    exit(1)

COMMITTEE_ID = row[0]
print(f"Targeting Committee ID: {COMMITTEE_ID}")

lucky_tokens = {}

# 1. Scan Main CSV for 'lucky' entries
with open(FILE_MAIN, mode="r", encoding="utf-8-sig", errors="replace") as f:
    reader = csv.reader(f)
    headers = [h.strip() for h in next(reader)]
    
    for row in reader:
        if not row or not row[0].strip():
            continue
        token_no = row[0].strip()
        name = row[1].strip() if len(row) > 1 else ""
        
        for idx in range(7, len(row)):
            cell = row[idx].strip()
            if "lucky" in cell.lower():
                month_name = headers[idx] if idx < len(headers) else f"Month #{idx-6}"
                if token_no not in lucky_tokens:
                    lucky_tokens[token_no] = (month_name, name)
                break

# 2. Scan Gift Sheets CSV for 'lucky' entries
with open(FILE_GIFTS_SHEET, mode="r", encoding="utf-8-sig", errors="replace") as f:
    reader = csv.reader(f)
    row1 = next(reader, None)
    row2 = next(reader, None)

    for row in reader:
        if not row:
            continue
        for idx in range(0, len(row) - 2, 4):
            member_name = row[idx].strip() if idx < len(row) else ""
            token_no = row[idx+1].strip() if idx+1 < len(row) else ""
            status = row[idx+2].strip() if idx+2 < len(row) else ""

            if token_no and "lucky" in status.lower():
                if token_no not in lucky_tokens:
                    lucky_tokens[token_no] = ("Gift Sheet", member_name)

print(f"\nFound {len(lucky_tokens)} Lucky Draw Winner Tokens (Status: OUT/LUCKY)!")

# Update tokens & committee_members status in Database
updated_tokens_count = 0
for tok_num, (won_month, m_name) in lucky_tokens.items():
    # Update token status to 'lucky'
    cur.execute("""
        UPDATE tokens 
        SET status = 'lucky', updated_at = NOW()
        WHERE committee_id = %s AND token_number = %s
    """, (COMMITTEE_ID, tok_num))
    
    # Update committee_members status to 'completed'
    cur.execute("""
        UPDATE committee_members
        SET status = 'completed'
        WHERE committee_id = %s AND token_number = %s
    """, (COMMITTEE_ID, tok_num))
    
    updated_tokens_count += 1
    print(f"  * Token #{tok_num} ({m_name or 'Member'}): Marked as LUCKY (OUT) in {won_month}")

conn.commit()

# Verification
cur.execute("SELECT COUNT(*) FROM tokens WHERE committee_id = %s AND status = 'lucky'", (COMMITTEE_ID,))
lucky_db_count = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM tokens WHERE committee_id = %s AND status = 'active'", (COMMITTEE_ID,))
active_db_count = cur.fetchone()[0]

print("\n=======================================================")
print(f"SUCCESS! LUCKY DRAW (OUT) STATUS UPDATED:")
print(f"   * Total Lucky Draw Winners (OUT): {lucky_db_count}")
print(f"   * Total Active (IN) Tokens: {active_db_count}")
print(f"   * Total Bissi Seats: {lucky_db_count + active_db_count} / 500")
print("=======================================================")

cur.close()
conn.close()
