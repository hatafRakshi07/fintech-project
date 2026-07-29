import xlsx from 'xlsx';

const file = 'C:/Users/lenovo/Downloads/Bissi folder (5).xlsx';
const wb = xlsx.readFile(file);

const sheetsConfig = [
  { sheetName: 'Sawariya seth 5 date', committeeId: 1, defaultAmount: 3000, tokenCol: 0, nameCol: 1, phoneCol: 3, instStartCol: 7 },
  { sheetName: 'Pyare mohan 15 date', committeeId: 2, defaultAmount: 3000, tokenCol: 0, nameCol: 1, phoneCol: 4, instStartCol: 8 },
  { sheetName: 'Hare ka sahara bissi 20 date', committeeId: 3, defaultAmount: 2500, tokenCol: 0, nameCol: 1, phoneCol: 3, instStartCol: 7 },
  { sheetName: 'Shree Krishna associate lottery', committeeId: 4, defaultAmount: 3000, tokenCol: 0, nameCol: 1, phoneCol: 3, instStartCol: 6 },
];

function cleanMobile(val) {
  if (!val) return null;
  const str = String(val).replace(/[^\d]/g, '');
  if (str.length >= 10) return str.slice(-10);
  return null;
}

let totalPaid = 0;
let totalPending = 0;

for (const cfg of sheetsConfig) {
  const ws = wb.Sheets[cfg.sheetName];
  if (!ws) continue;
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  const headerRow = rows[0] || [];

  let sheetPaid = 0;
  let sheetPending = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row[cfg.tokenCol] === undefined || row[cfg.tokenCol] === null || String(row[cfg.tokenCol]).trim() === '') continue;

    // Check installment columns from instStartCol to end of header
    for (let c = cfg.instStartCol; c < Math.min(row.length, cfg.instStartCol + 20); c++) {
      const val = row[c];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const strVal = String(val).trim().toLowerCase();
        if (strVal === 'lucky' || strVal === 'out' || strVal === 'closed' || strVal === 'running') {
          // Lucky status column, not numerical payment
          continue;
        }
        const num = parseFloat(strVal.replace(/[^\d.]/g, ''));
        if (!isNaN(num) && num > 0) {
          sheetPaid++;
        } else if (strVal === 'paid' || strVal === 'p' || strVal === 'yes') {
          sheetPaid++;
        } else {
          sheetPending++;
        }
      } else {
        sheetPending++;
      }
    }
  }

  console.log(`Sheet: ${cfg.sheetName} -> Paid: ${sheetPaid}, Pending: ${sheetPending}`);
  totalPaid += sheetPaid;
  totalPending += sheetPending;
}

console.log(`TOTAL PAID INSTALLMENTS: ${totalPaid}`);
console.log(`TOTAL PENDING INSTALLMENTS: ${totalPending}`);
