import openpyxl, sys, re
from collections import defaultdict
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

EXCEL_PATH = r"C:\Users\iSN_kota_T52\Downloads\Bissi folder.xlsx"
wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)

scheme_sheets = [
    ("Sawariya seth 5 date",           1, 500,  3000),
    ("Pyare mohan 15 date",            2, 500,  3000),
    ("Hare ka sahara bissi 20 date",   3, 500,  2500),
    ("Shree Krishna associate lottery", 4, 1111, 3000),
]

def try_parse_date(val):
    if not val: return None
    if isinstance(val, datetime): return val
    from datetime import date as d_
    if isinstance(val, d_): return datetime(val.year, val.month, val.day)
    s = str(val).strip()
    parts = re.split(r"[/-]", s)
    if len(parts) == 3:
        try:
            d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
            if y < 100: y += 2000
            return datetime(y, m, d)
        except: pass
    return None

issues = defaultdict(list)

for sh_name, c_id, max_tok, default_amt in scheme_sheets:
    ws = wb[sh_name]
    rows = [r for r in ws.iter_rows(values_only=True) if r and any(x is not None for x in r)]
    if not rows: continue

    header_row = rows[0]
    month_cols = []
    bad_dates = []
    for idx in range(6, len(header_row)):
        val = header_row[idx]
        if val is not None:
            d = try_parse_date(val)
            if d:
                month_cols.append((idx, val, d))
            else:
                bad_dates.append((idx, val))

    seen_tokens = {}         # token -> [row indices]
    seen_names  = defaultdict(list)  # name -> [tokens]
    seen_mobiles = defaultdict(list) # mobile -> [tokens]

    for row_idx, r in enumerate(rows[1:], start=2):
        if all(x is None for x in r): continue

        raw_tok = str(r[0]).strip().split(".")[0] if r[0] else ""
        name    = str(r[1]).strip() if r[1] else ""
        ref     = str(r[2]).strip() if r[2] else ""
        mobile  = str(r[3]).strip() if r[3] else ""

        # 1. Non-numeric or missing token
        if not raw_tok.isdigit():
            issues[sh_name].append(f"Row {row_idx}: Token missing or non-numeric → '{raw_tok}'")
            continue
        token = int(raw_tok)

        # 2. Token out of range
        if token < 1 or token > max_tok:
            issues[sh_name].append(f"Row {row_idx}: Token {token} OUT OF RANGE (1-{max_tok})")

        # 3. Duplicate token
        if raw_tok in seen_tokens:
            issues[sh_name].append(f"Row {row_idx}: DUPLICATE Token {token} (also in row {seen_tokens[raw_tok]})")
        seen_tokens[raw_tok] = row_idx

        # 4. Blank name AND blank reference
        if (not name or name.lower() == "none") and (not ref or ref.lower() in ("none", "", "jsk", "-")):
            has_any_pay = any(r[i] is not None and str(r[i]).strip() not in ("", "None") for i in range(7, min(15, len(r))))
            if has_any_pay:
                issues[sh_name].append(f"Row {row_idx}: Token {token} — NO NAME & NO REFERENCE (but has payments)")

        # 5. Invalid/suspicious mobile
        if mobile and mobile.lower() != "none":
            clean_mob = re.sub(r"\D", "", mobile)
            if len(clean_mob) not in (10, 11, 12):
                issues[sh_name].append(f"Row {row_idx}: Token {token} — INVALID mobile '{mobile}'")
            else:
                if len(clean_mob) == 10:
                    seen_mobiles[clean_mob].append(token)

        # 6. Track name duplicates
        if name and name.lower() not in ("none", ""):
            norm = name.strip().lower()
            seen_names[norm].append(token)

        # 7. Payment amount issues
        for col_idx, raw_hdr, m_date in month_cols:
            if col_idx < len(r) and r[col_idx] is not None:
                cell = str(r[col_idx]).strip()
                if cell.lower() in ("none", "", "-"): continue
                clean = re.sub(r"[^\d.]", "", cell)
                try:
                    amt = float(clean) if clean and clean != "." else 0
                    if amt == 0:
                        issues[sh_name].append(f"Row {row_idx}: Token {token} — ZERO amount in col {col_idx} ('{cell}')")
                    elif amt > 50000:
                        issues[sh_name].append(f"Row {row_idx}: Token {token} — SUSPICIOUSLY LARGE amount ₹{amt:,.0f} in col {col_idx}")
                    elif amt < 100:
                        issues[sh_name].append(f"Row {row_idx}: Token {token} — VERY SMALL amount ₹{amt} in col {col_idx} ('{cell}')")
                except:
                    issues[sh_name].append(f"Row {row_idx}: Token {token} — NON-NUMERIC amount '{cell}' in col {col_idx}")

    # 8. Duplicate names (same name, multiple tokens)
    dup_names = {n: toks for n, toks in seen_names.items() if len(toks) > 1}
    if dup_names:
        for n, toks in list(dup_names.items())[:10]:
            issues[sh_name].append(f"MULTI-TOKEN: '{n}' has {len(toks)} tokens → {toks[:8]}")

    # 9. Duplicate mobiles
    dup_mob = {m: toks for m, toks in seen_mobiles.items() if len(toks) > 1}
    if dup_mob:
        for mob, toks in list(dup_mob.items())[:5]:
            issues[sh_name].append(f"DUPLICATE MOBILE {mob}: tokens {toks[:6]}")

    # 10. Bad header dates
    for idx, val in bad_dates:
        issues[sh_name].append(f"HEADER: Column {idx} has unparseable date → '{val}'")

# ── Print Report ─────────────────────────────────────────────
print("=" * 70)
print("         EXCEL SHEET — COMPLETE ISSUE AUDIT")
print("=" * 70)

total = 0
for sh_name, c_id, max_tok, _ in scheme_sheets:
    sh_issues = issues.get(sh_name, [])
    categories = defaultdict(list)
    for issue in sh_issues:
        if "DUPLICATE Token"    in issue: categories["🔁 Duplicate Tokens"].append(issue)
        elif "OUT OF RANGE"     in issue: categories["⛔ Out of Range Tokens"].append(issue)
        elif "NO NAME"          in issue: categories["👻 No Name/Ref"].append(issue)
        elif "INVALID mobile"   in issue: categories["📵 Invalid Mobile"].append(issue)
        elif "ZERO amount"      in issue: categories["0️⃣  Zero Amounts"].append(issue)
        elif "LARGE amount"     in issue: categories["💰 Suspiciously Large"].append(issue)
        elif "SMALL amount"     in issue: categories["🔸 Very Small Amount"].append(issue)
        elif "NON-NUMERIC"      in issue: categories["❌ Non-numeric Amount"].append(issue)
        elif "MULTI-TOKEN"      in issue: categories["👥 Multi-Token Customers"].append(issue)
        elif "DUPLICATE MOBILE" in issue: categories["📱 Duplicate Mobile"].append(issue)
        elif "HEADER"           in issue: categories["📅 Bad Header Dates"].append(issue)
        elif "Token missing"    in issue: categories["❓ Missing Token"].append(issue)
        else:                             categories["🔍 Other"].append(issue)

    print(f"\n{'─'*70}")
    print(f"📋 {sh_name} (max: {max_tok} tokens)")
    print(f"{'─'*70}")
    if not sh_issues:
        print("   ✅ No issues found!")
    else:
        print(f"   Total issues: {len(sh_issues)}")
        for cat, items in categories.items():
            print(f"\n   {cat} ({len(items)})")
            # Only show first 5 per category
            for item in items[:5]:
                print(f"      → {item}")
            if len(items) > 5:
                print(f"      ... and {len(items)-5} more")
        total += len(sh_issues)

print(f"\n{'='*70}")
print(f"   TOTAL ISSUES FOUND: {total}")
print(f"{'='*70}")
