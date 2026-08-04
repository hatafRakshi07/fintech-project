import xlsx from 'xlsx';

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx';
const wb = xlsx.readFile(filePath);

const schemeSheets = [
  { name: 'Sawariya seth 5 date', scheme: 'Sawariya Seth Bissi (5th Date)' },
  { name: 'Pyare mohan 15 date', scheme: 'Pyare Mohan Bissi (15th Date)' },
  { name: 'Hare ka sahara bissi 20 date', scheme: 'Hare Ka Sahara Bissi (20th Date)' },
  { name: 'Shree Krishna associate lottery', scheme: 'Shree Krishna Associates Bissi (20th Date)' }
];

console.log("=== DUPLICATE TOKEN AUDIT IN EXCEL WORKBOOK ===");

const allDuplicates = [];

for (const sItem of schemeSheets) {
  const actualName = wb.SheetNames.find(s => s.trim().toLowerCase() === sItem.name.trim().toLowerCase());
  if (!actualName) {
    console.log(`❌ Sheet missing: ${sItem.name}`);
    continue;
  }
  const sheet = wb.Sheets[actualName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const tokenMap = new Map();

  // Row 0 is headers, data starts from Row 1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Token number is typically col 0 or 2 depending on sheet
    let rawToken = row[0];
    let name = row[1];
    let phone = row[3] || row[4];

    if (rawToken === undefined || rawToken === null || String(rawToken).trim() === '') continue;

    const tokenNo = parseInt(String(rawToken).replace(/[^0-9]/g, ''), 10);
    if (isNaN(tokenNo)) continue;

    if (!tokenMap.has(tokenNo)) {
      tokenMap.set(tokenNo, []);
    }
    tokenMap.get(tokenNo).push({ rowIndex: i + 1, name, phone });
  }

  const duplicatesInScheme = [];
  for (const [tNo, list] of tokenMap.entries()) {
    if (list.length > 1) {
      duplicatesInScheme.push({ tokenNo: tNo, count: list.length, occurrences: list });
    }
  }

  console.log(`\n----------------------------------------`);
  console.log(`Scheme: ${sItem.scheme} ("${actualName}")`);
  console.log(`Total Token Entries Found: ${tokenMap.size}`);
  console.log(`Duplicate Token Numbers Count: ${duplicatesInScheme.length}`);

  if (duplicatesInScheme.length > 0) {
    console.log(`Duplicate Tokens Detail:`);
    for (const dup of duplicatesInScheme) {
      console.log(`  - Token #${dup.tokenNo} appears ${dup.count} times:`);
      for (const occ of dup.occurrences) {
        console.log(`      Row ${occ.rowIndex}: Name="${occ.name}", Phone=${occ.phone}`);
      }
      allDuplicates.push({ scheme: sItem.scheme, ...dup });
    }
  } else {
    console.log(`  ✅ Zero duplicate token numbers in this scheme.`);
  }
}

console.log("\n========================================");
console.log(`TOTAL DUPLICATE TOKENS FOUND ACROSS ALL SCHEMES: ${allDuplicates.length}`);
