import os

downloads_dir = r"C:\Users\iSN_kota_T52\Downloads"
print("Searching in Downloads directory...")

matches = []
for root, dirs, files in os.walk(downloads_dir):
    for d in dirs:
        if "gift" in d.lower() or "bissi" in d.lower():
            matches.append(("dir", os.path.join(root, d)))
    for f in files:
        if ("gift" in f.lower() or "bissi" in f.lower()) and not f.startswith("~$"):
            matches.append(("file", os.path.join(root, f)))

print(f"\nFound {len(matches)} matching items:")
for mtype, mpath in matches[:30]:
    print(f"[{mtype.upper()}] {mpath}")
