import os
import csv
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

gift_folder = r"C:\Users\iSN_kota_T52\Downloads\gift sheet"
files = [f for f in os.listdir(gift_folder) if f.endswith(".csv")]

print(f"Found {len(files)} CSV files in '{gift_folder}':\n")

for f in files:
    fpath = os.path.join(gift_folder, f)
    with open(fpath, "r", encoding="utf-8", errors="ignore") as file:
        reader = list(csv.reader(file))
        print(f"--- File: {f} ---")
        print(f"Total Rows: {len(reader)}")
        if reader:
            print("Header (Row 1):", reader[0][:12])
            for i in range(1, min(5, len(reader))):
                print(f"Row {i+1}:", reader[i][:12])
        print()
