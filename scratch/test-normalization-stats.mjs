import xlsx from 'xlsx';

const file = 'C:/Users/lenovo/Downloads/Bissi folder (5).xlsx';
const wb = xlsx.readFile(file);

const sheetsConfig = [
  { sheetName: 'Sawariya seth 5 date', committeeId: 1, committeeName: 'Sawariya Seth Bissi', defaultAmount: 3000, tokenCol: 0, nameCol: 1, refCol: 2, phoneCol: 3, addrCol: 5, instStartCol: 7 },
  { sheetName: 'Pyare mohan 15 date', committeeId: 2, committeeName: 'Pyare Mohan Bissi', defaultAmount: 3000, tokenCol: 0, nameCol: 1, refCol: 2, phoneCol: 4, addrCol: 6, instStartCol: 8 },
  { sheetName: 'Hare ka sahara bissi 20 date', committeeId: 3, committeeName: 'Hare Ka Sahara Bissi', defaultAmount: 2500, tokenCol: 0, nameCol: 1, refCol: 2, phoneCol: 3, addrCol: 4, instStartCol: 7 },
  { sheetName: 'Shree Krishna associate lottery', committeeId: 4, committeeName: 'Shree Krishna Bissi', defaultAmount: 3000, tokenCol: 0, nameCol: 1, refCol: 2, phoneCol: 3, addrCol: 4, instStartCol: 6 },
];

function cleanMobile(val) {
  if (!val) return null;
  const str = String(val).replace(/[^\d]/g, '');
  if (str.length >= 10) return str.slice(-10);
  return null;
}

function cleanName(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'jsk' || s.toLowerCase() === 'none') return null;
  return s;
}

let totalHalfTokensConverted = 0;
let totalDuplicateTokensRenamed = 0;
let totalTokensExtracted = 0;

for (const cfg of sheetsConfig) {
  const ws = wb.Sheets[cfg.sheetName];
  if (!ws) {
    console.error(`Sheet not found: ${cfg.sheetName}`);
    continue;
  }

  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n========================================`);
  console.log(`Processing Sheet: ${cfg.sheetName} (Rows: ${rows.length})`);

  let sheetHalfTokens = 0;
  let sheetTotalTokens = 0;

  // Extract raw rows
  const extracted = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let rawToken = row[cfg.tokenCol];
    const name = cleanName(row[cfg.nameCol]);
    const ref = cleanName(row[cfg.refCol]);
    const phone = cleanMobile(row[cfg.phoneCol]);
    const addr = row[cfg.addrCol] ? String(row[cfg.addrCol]).trim() : null;

    if (rawToken === undefined || rawToken === null || String(rawToken).trim() === '') continue;

    let tokenStr = String(rawToken).trim();
    // Check half token
    if (tokenStr.includes('1/2') || tokenStr.includes('½') || tokenStr.includes('(1/2)')) {
      sheetHalfTokens++;
      tokenStr = tokenStr.replace(/\(1\/2\)/g, '').replace(/1\/2/g, '').replace(/½/g, '').trim();
    }

    sheetTotalTokens++;
    extracted.push({
      rowIndex: r,
      baseToken: tokenStr,
      name,
      ref,
      phone,
      addr,
      row
    });
  }

  // Group by baseToken to handle duplicate token numbers in same Bissi
  const grouped = new Map();
  for (const item of extracted) {
    if (!grouped.has(item.baseToken)) grouped.set(item.baseToken, []);
    grouped.get(item.baseToken).push(item);
  }

  let sheetDuplicates = 0;
  for (const [baseToken, items] of grouped.entries()) {
    if (items.length > 1) {
      sheetDuplicates += items.length;
      items.forEach((item, idx) => {
        const letter = String.fromCharCode(65 + idx); // A, B, C...
        item.normalizedToken = `${baseToken}${letter}`;
      });
    } else {
      items[0].normalizedToken = baseToken;
    }
  }

  console.log(`  Extracted Tokens: ${sheetTotalTokens}`);
  console.log(`  Half Tokens Converted: ${sheetHalfTokens}`);
  console.log(`  Duplicate Tokens Renamed: ${sheetDuplicates}`);

  totalHalfTokensConverted += sheetHalfTokens;
  totalDuplicateTokensRenamed += sheetDuplicates;
  totalTokensExtracted += sheetTotalTokens;
}

console.log(`\n========================================`);
console.log(`TOTAL STATS SUMMARY:`);
console.log(`Total Tokens Extracted: ${totalTokensExtracted}`);
console.log(`Total Half Tokens Converted: ${totalHalfTokensConverted}`);
console.log(`Total Duplicate Tokens Renamed: ${totalDuplicateTokensRenamed}`);
