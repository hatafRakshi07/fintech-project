import os
import re
import csv
import sys
import psycopg2
from datetime import datetime, date

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

NEON_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
)
GIFT_FOLDER = r"C:\Users\iSN_kota_T52\Downloads\gift sheet"

def clean_phone(val):
    if not val: return None
    s = re.sub(r"[^\d]", "", str(val).split(".")[0])
    s = s[-10:] if len(s) >= 10 else s
    return s if len(s) >= 6 else None

def clean_name(val):
    if not val: return None
    v = str(val).strip()
    v = re.sub(r"\s+", " ", v)
    return v if v and v.lower() not in ("none", "name", "name ", "", "jsk", "-") else None

MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
    "nov": 11, "november": 11, "dec": 12, "december": 12
}

def parse_header_date(col_name, default_day=25):
    if not col_name: return None
    s = str(col_name).strip().lower()
    
    # Check YYYY-MM-DD pattern
    m_ymd = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", s)
    if m_ymd:
        return datetime(int(m_ymd.group(1)), int(m_ymd.group(2)), int(m_ymd.group(3)))

    # Check Month-YY pattern (e.g. June-26, July-24, March-25)
    parts = re.split(r"[\s\-_]+", s)
    m_num, year = None, None
    for p in parts:
        if p in MONTH_MAP:
            m_num = MONTH_MAP[p]
        elif p.isdigit():
            y_val = int(p)
            year = 2000 + y_val if y_val < 100 else y_val
            
    if m_num and year:
        return datetime(year, m_num, min(default_day, 28))
    return None

def run_perfect_import():
    print("=== PERFECT GIFT & TOKEN LIMIT IMPORT FROM 'GIFT SHEET' FOLDER ===")
    conn = psycopg2.connect(NEON_URL)
    cur = conn.cursor()

    # 1. FIX TOKEN COUNTS & MEMBER LIMITS FOR ALL 4 COMMITTEES
    print("\nFixing token limits & removing invalid extra tokens > limits...")
    cur.execute("UPDATE committees SET member_limit = 500, installment_amount = 3000.0 WHERE id = 1")
    cur.execute("UPDATE committees SET member_limit = 500, installment_amount = 3000.0 WHERE id = 2")
    cur.execute("UPDATE committees SET member_limit = 500, installment_amount = 2500.0 WHERE id = 3")
    cur.execute("UPDATE committees SET member_limit = 1111, installment_amount = 3000.0 WHERE id = 4")

    # Clean out non-numeric and tokens higher than strict limits (e.g. > 500 for id 1,2,3; > 1111 for id 4)
    cur.execute("DELETE FROM tokens WHERE token_number !~ '^[0-9]+$'")
    cur.execute("DELETE FROM committee_members WHERE token_number !~ '^[0-9]+$'")

    cur.execute("DELETE FROM tokens WHERE committee_id IN (1,2,3) AND token_number ~ '^[0-9]+$' AND token_number::integer > 500")
    cur.execute("DELETE FROM tokens WHERE committee_id = 4 AND token_number ~ '^[0-9]+$' AND token_number::integer > 1111")
    cur.execute("DELETE FROM committee_members WHERE committee_id IN (1,2,3) AND token_number ~ '^[0-9]+$' AND token_number::integer > 500")
    cur.execute("DELETE FROM committee_members WHERE committee_id = 4 AND token_number ~ '^[0-9]+$' AND token_number::integer > 1111")
    conn.commit()
    print("  Token limits set to exact 500, 500, 500, 1111.")

    # Cache customers
    cur.execute("SELECT id, name, mobile FROM customers")
    customers = {}
    for cid, name, mob in cur.fetchall():
        if mob: customers[mob] = cid
        if name: customers[name.lower().strip()] = cid

    def get_or_create_customer(name, mobile=None):
        name_clean = clean_name(name)
        mob_clean = clean_phone(mobile)
        if mob_clean and mob_clean in customers: return customers[mob_clean]
        if name_clean and name_clean.lower() in customers: return customers[name_clean.lower()]

        final_name = name_clean or f"Member #{mob_clean or 'Unknown'}"
        final_mob = mob_clean or f"9000{len(customers)+100000:06d}"
        ref_no = f"REF-{len(customers) + 1001}"
        cur.execute("""
            INSERT INTO customers (name, mobile, reference_number, branch_id, status, created_at, updated_at)
            VALUES (%s, %s, %s, 1, 'active', NOW(), NOW())
            RETURNING id
        """, (final_name, final_mob, ref_no))
        cid = cur.fetchone()[0]
        customers[final_mob] = cid
        if name_clean: customers[name_clean.lower()] = cid
        return cid

    # Clear lotteries & re-import cleanly with exact dates
    cur.execute("TRUNCATE TABLE lotteries RESTART IDENTITY")

    file_mapping = [
        ("Bissi folder - Sawariya seth bissi gift record.csv", 1, 500),
        ("Bissi folder - Pyare mohan bissi gift records.csv", 2, 500),
        ("Bissi folder - Pyare Mohan bissi gift sheets.csv", 2, 500),
        ("Bissi folder - Hare ka sahara bissi gift records.csv", 3, 500),
        ("Bissi folder - Hare ka sahara bissi gift sheets.csv", 3, 500),
        ("Bissi folder - Shree krishna gift sheet.csv", 4, 1111),
        ("Bissi folder - Shree krishna aasociates gift record.csv", 4, 1111),
        ("Bissi folder - Shree Krishna associate lottery.csv", 4, 1111),
    ]

    total_gifts_imported = 0

    for fname, comm_id, max_token in file_mapping:
        fpath = os.path.join(GIFT_FOLDER, fname)
        if not os.path.exists(fpath): continue
        print(f"\nImporting gifts from: '{fname}' (Committee ID {comm_id})...")

        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            reader = list(csv.reader(f))
            if len(reader) <= 1: continue

            # Determine layout format
            header1 = reader[0]
            header2 = reader[1] if len(reader) > 1 else []

            # Format A: Single row date headers (e.g. Token No, Name, Date1, Date2, ...)
            date_cols = []
            for col_idx, col_val in enumerate(header1):
                dt = parse_header_date(col_val)
                if dt:
                    date_cols.append((col_idx, dt))

            # Process data rows
            for row_idx, row in enumerate(reader[1:], start=2):
                if not row or len(row) < 2: continue

                # Try finding Token No in row
                token_num = None
                for c in row[:4]:
                    c_str = str(c).split(".")[0].strip()
                    if c_str.isdigit():
                        t_val = int(c_str)
                        if 1 <= t_val <= max_token:
                            token_num = t_val
                            break
                
                if not token_num: continue

                c_name = row[1] if len(row) > 1 else None
                mob = row[3] if len(row) > 3 else None
                cust_id = get_or_create_customer(c_name or f"Token #{token_num}", mob)

                # Ensure Token in DB within strict limit
                cur.execute("""
                    INSERT INTO tokens (token_number, committee_id, customer_id, status, created_at)
                    VALUES (%s, %s, %s, 'active', NOW())
                    ON CONFLICT DO NOTHING
                """, (str(token_num), comm_id, cust_id))

                cur.execute("""
                    INSERT INTO committee_members (committee_id, customer_id, token_number, status, joined_at)
                    VALUES (%s, %s, %s, 'active', NOW())
                    ON CONFLICT DO NOTHING
                """, (comm_id, cust_id, str(token_num)))

                # Import Gifts across date columns
                for col_idx, exact_date in date_cols:
                    if col_idx < len(row):
                        gift_val = str(row[col_idx]).strip()
                        if gift_val and gift_val.lower() not in ("none", "", "-", "0", "done"):
                            cur.execute("""
                                INSERT INTO lotteries (committee_id, winner_id, draw_date, notes, status, created_at)
                                VALUES (%s, %s, %s, %s, 'completed', %s)
                            """, (comm_id, cust_id, exact_date, f"Winner Reward: {gift_val}", exact_date))
                            total_gifts_imported += 1

            # Format B: Multi-column block headers (e.g. Gift Status columns in 'gift sheets.csv')
            if "gift sheets" in fname.lower() or "gift sheet" in fname.lower():
                print(f"  Processing block layout for '{fname}'...")
                # Iterate through header blocks in row 1 & row 2
                for block_idx in range(0, len(header1) - 2, 4):
                    block_date = parse_header_date(header1[block_idx])
                    if not block_date and block_idx < len(header1):
                        block_date = parse_header_date(header1[block_idx])
                    if not block_date: continue

                    for r in reader[2:]:
                        if len(r) > block_idx + 2:
                            r_name = r[block_idx] if len(r) > block_idx else None
                            r_token = str(r[block_idx + 1]).split(".")[0].strip() if len(r) > block_idx + 1 else None
                            r_gift = str(r[block_idx + 2]).strip() if len(r) > block_idx + 2 else None

                            if r_token.isdigit():
                                t_num = int(r_token)
                                if 1 <= t_num <= max_token and r_gift and r_gift.lower() not in ("none", "", "-", "0"):
                                    c_id = get_or_create_customer(r_name or f"Token #{t_num}")
                                    cur.execute("""
                                        INSERT INTO lotteries (committee_id, winner_id, draw_date, notes, status, created_at)
                                        VALUES (%s, %s, %s, %s, 'completed', %s)
                                    """, (comm_id, c_id, block_date, f"Winner Reward: {r_gift}", block_date))
                                    total_gifts_imported += 1

    conn.commit()
    print(f"\n=======================================================")
    print(f"  PERFECT IMPORT COMPLETE!")
    print(f"  Total Gift/Lottery Records Imported: {total_gifts_imported}")
    print(f"=======================================================")
    cur.close()
    conn.close()

if __name__ == "__main__":
    run_perfect_import()
