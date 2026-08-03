import XLSX from 'xlsx';

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx';
const wb = XLSX.readFile(filePath);

const bissiSheets = [
  'Sawariya seth 5 date',
  'Pyare mohan 15 date',
  'Hare ka sahara bissi 20 date',
  'Shree Krishna associate lottery'
];

console.log('=== DETAILED BISSI TOKEN DUPLICATE SCAN ===\n');

bissiSheets.forEach(sheetName => {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const tokenCountMap = new Map();

  rows.forEach((row, rIdx) => {
    if (rIdx === 0) return;
    const tokenVal = row[0] !== undefined ? String(row[0]).trim() : '';
    if (!tokenVal || isNaN(Number(tokenVal))) return;

    const tNum = Number(tokenVal);
    if (!tokenCountMap.has(tNum)) {
      tokenCountMap.set(tNum, []);
    }
    tokenCountMap.get(tNum).push({
      row: rIdx + 1,
      name: String(row[1] || '').trim(),
      reference: String(row[2] || '').trim(),
      mobile: String(row[3] || row[5] || '').trim(),
      address: String(row[5] || row[4] || '').trim(),
      fullRow: row.slice(0, 8)
    });
  });

  const duplicates = [];
  tokenCountMap.forEach((entries, tokenNo) => {
    if (entries.length > 1) {
      duplicates.push({ tokenNo, entries });
    }
  });

  console.log(`\n--------------------------------------------------`);
  console.log(`SCHEME SHEET: "${sheetName}"`);
  console.log(`Total Token Entries: ${rows.length - 1} | Unique Tokens: ${tokenCountMap.size}`);
  if (duplicates.length > 0) {
    console.log(`⚠️ DUPLICATES FOUND: ${duplicates.length}`);
    duplicates.forEach(d => {
      console.log(`  👉 Token #${d.tokenNo}:`);
      d.entries.forEach(e => {
        console.log(`     - Row ${e.row}: Name: "${e.name}", Ref: "${e.reference}", Mobile: "${e.mobile}", Address: "${e.address}"`);
      });
    });
  } else {
    console.log(`✅ Clean! No duplicate token numbers.`);
  }
});

// Analyze Daily Diary Sheet Details
console.log(`\n==============================================`);
console.log(`DAILY DIARY SHEET SUMMARY`);
console.log(`==============================================`);
const ddSheet = wb.Sheets['daily diary'];
if (ddSheet) {
  const ddRows = XLSX.utils.sheet_to_json(ddSheet, { header: 1, defval: '' });
  console.log(`Header Row:`, ddRows[0]);
  console.log(`Total Accounts in Daily Diary: ${ddRows.length - 1}`);

  let validAccounts = 0;
  ddRows.slice(1).forEach((r, idx) => {
    const name = String(r[0] || '').trim();
    const amount = Number(r[7]);
    if (name) validAccounts++;
  });
  console.log(`Valid Named Daily Diary Accounts: ${validAccounts}`);
}

// Analyze Gift Sheets Summary
console.log(`\n==============================================`);
console.log(`GIFT RECORDS SUMMARY`);
console.log(`==============================================`);

const giftRecordSheets = [
  'Sawariya seth bissi gift record',
  'Pyare mohan bissi gift records',
  'Hare ka sahara bissi gift recor',
  'Shree krishna aasociates gift r'
];

giftRecordSheets.forEach(gName => {
  const gSheet = wb.Sheets[gName];
  if (!gSheet) return;
  const gRows = XLSX.utils.sheet_to_json(gSheet, { header: 1, defval: '' });
  console.log(`\nGift Sheet: "${gName}" (${gRows.length - 1} records)`);
  if (gRows.length > 0) {
    console.log(`  Columns:`, gRows[0].slice(0, 10));
  }
});
