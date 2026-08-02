import XLSX from 'xlsx';

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx';
const wb = XLSX.readFile(filePath);

console.log('--- ANALYSIS OF Bissi folder (4).xlsx ---\n');

const bissiSheets = [
  { name: 'Sawariya seth 5 date', scheme: 'Sawariya Seth Bissi (5th Date)' },
  { name: 'Pyare mohan 15 date', scheme: 'Pyare Mohan Bissi (15th Date)' },
  { name: 'Hare ka sahara bissi 20 date', scheme: 'Hare Ka Sahara Bissi (20th Date)' },
  { name: 'Shree Krishna associate lottery', scheme: 'Shree Krishna Associates Bissi' }
];

const duplicateTokensReport = [];
const parsedBissiData = {};

bissiSheets.forEach(({ name, scheme }) => {
  if (!wb.Sheets[name]) {
    console.log(`Sheet not found: ${name}`);
    return;
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  console.log(`\n==============================================`);
  console.log(`SHEET: "${name}" (${rows.length} total rows)`);
  console.log(`==============================================`);

  const tokenMap = new Map();
  const duplicatesInSheet = [];

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    console.log(`Row ${r}:`, rows[r].slice(0, 8));
  }

  rows.forEach((row, idx) => {
    if (idx === 0) return;
    const tokenNo = row[0] !== undefined ? String(row[0]).trim() : '';
    const nameVal = row[1] !== undefined ? String(row[1]).trim() : '';
    const mobileVal = row[2] !== undefined ? String(row[2]).trim() : '';

    if (!tokenNo || isNaN(Number(tokenNo))) return;

    const tNum = Number(tokenNo);
    if (tokenMap.has(tNum)) {
      duplicatesInSheet.push({
        tokenNo: tNum,
        firstEntry: tokenMap.get(tNum),
        duplicateEntry: { row: idx + 1, name: nameVal, mobile: mobileVal, rawRow: row.slice(0, 6) }
      });
    } else {
      tokenMap.set(tNum, { row: idx + 1, name: nameVal, mobile: mobileVal, rawRow: row.slice(0, 6) });
    }
  });

  if (duplicatesInSheet.length > 0) {
    duplicateTokensReport.push({
      scheme: name,
      count: duplicatesInSheet.length,
      duplicates: duplicatesInSheet
    });
    console.log(`⚠️ DUPLICATES FOUND IN "${name}":`, duplicatesInSheet.length);
  } else {
    console.log(`✓ No duplicate token numbers found in "${name}". Total unique tokens: ${tokenMap.size}`);
  }
  parsedBissiData[name] = { totalRows: rows.length, uniqueTokens: tokenMap.size, duplicates: duplicatesInSheet };
});

// Analyze Daily Diary Sheet
console.log(`\n==============================================`);
console.log(`SHEET: "daily diary"`);
console.log(`==============================================`);
if (wb.Sheets['daily diary']) {
  const ddRows = XLSX.utils.sheet_to_json(wb.Sheets['daily diary'], { header: 1, defval: '' });
  console.log(`Total Rows in daily diary: ${ddRows.length}`);
  for (let r = 0; r < Math.min(8, ddRows.length); r++) {
    console.log(`DD Row ${r}:`, ddRows[r].slice(0, 10));
  }
} else {
  console.log(`"daily diary" sheet not found!`);
}

// Analyze Gift Sheets
const giftSheets = wb.SheetNames.filter(s => s.toLowerCase().includes('gift'));
console.log(`\n==============================================`);
console.log(`GIFT SHEETS FOUND:`, giftSheets);
console.log(`==============================================`);
giftSheets.forEach(gName => {
  const gRows = XLSX.utils.sheet_to_json(wb.Sheets[gName], { header: 1, defval: '' });
  console.log(`Sheet "${gName}": ${gRows.length} rows`);
  if (gRows.length > 0) {
    console.log(`  Header / Row 0:`, gRows[0].slice(0, 8));
    if (gRows.length > 1) console.log(`  Sample Row 1:`, gRows[1].slice(0, 8));
  }
});

console.log('\n--- SUMMARY REPORT ---');
console.log(JSON.stringify(duplicateTokensReport, null, 2));
