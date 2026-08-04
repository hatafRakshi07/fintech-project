import xlsx from 'xlsx';

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx';
const wb = xlsx.readFile(filePath);

const schemeSheets = [
  { name: 'Sawariya seth 5 date', scheme: 'Sawariya Seth Bissi (5th Date)' },
  { name: 'Pyare mohan 15 date', scheme: 'Pyare Mohan Bissi (15th Date)' },
  { name: 'Hare ka sahara bissi 20 date', scheme: 'Hare Ka Sahara Bissi (20th Date)' },
  { name: 'Shree Krishna associate lottery', scheme: 'Shree Krishna Associates Bissi (20th Date)' }
];

console.log("=== COMPREHENSIVE TOKEN PARSING SCAN ===");

for (const sItem of schemeSheets) {
  const actualName = wb.SheetNames.find(s => s.trim().toLowerCase() === sItem.name.trim().toLowerCase());
  if (!actualName) continue;

  const sheet = wb.Sheets[actualName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const textTokens = [];
  const tokenCounts = new Map();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[0] === undefined || row[0] === null || String(row[0]).trim() === '') continue;

    const rawStr = String(row[0]).trim();
    if (rawStr.includes('/') || rawStr.includes('(') || rawStr.includes('a') || rawStr.includes('A') || isNaN(Number(rawStr))) {
      textTokens.push({ row: i + 1, raw: rawStr, name: row[1], phone: row[3] || row[4] });
    }

    if (!tokenCounts.has(rawStr)) {
      tokenCounts.set(rawStr, []);
    }
    tokenCounts.get(rawStr).push({ row: i + 1, name: row[1], phone: row[3] || row[4] });
  }

  console.log(`\n----------------------------------------`);
  console.log(`Scheme: ${sItem.scheme}`);
  console.log(`Total Rows with Token Values: ${rows.length - 1}`);

  if (textTokens.length > 0) {
    console.log(`Half-tokens / Text token labels found (${textTokens.length}):`);
    for (const t of textTokens) {
      console.log(`  Row ${t.row}: Token="${t.raw}" | Name="${t.name}" | Phone=${t.phone}`);
    }
  } else {
    console.log(`  Zero text/half token labels found.`);
  }

  const duplicates = [];
  for (const [key, list] of tokenCounts.entries()) {
    if (list.length > 1) {
      duplicates.push({ key, count: list.length, list });
    }
  }

  if (duplicates.length > 0) {
    console.log(`Duplicate exact token labels found (${duplicates.length}):`);
    for (const d of duplicates) {
      console.log(`  Token "${d.key}" appears ${d.count} times:`);
      for (const item of d.list) {
        console.log(`    Row ${item.row}: Name="${item.name}" | Phone=${item.phone}`);
      }
    }
  } else {
    console.log(`  Zero duplicate exact token labels.`);
  }
}
