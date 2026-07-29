import xlsx from 'xlsx';

const file = 'C:/Users/lenovo/Downloads/Bissi folder (5).xlsx';
const wb = xlsx.readFile(file);

const sheetsConfig = [
  { sheetName: 'Sawariya seth 5 date', instStartCol: 7 },
  { sheetName: 'Pyare mohan 15 date', instStartCol: 8 },
  { sheetName: 'Hare ka sahara bissi 20 date', instStartCol: 7 },
  { sheetName: 'Shree Krishna associate lottery', instStartCol: 6 },
];

function excelDateToDate(excelDate) {
  if (typeof excelDate === 'number') {
    // Excel date number conversion (1900 epoch)
    const date = new Date(Math.round((excelDate - (25567 + 2)) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  return String(excelDate);
}

for (const cfg of sheetsConfig) {
  const ws = wb.Sheets[cfg.sheetName];
  if (!ws) continue;
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  const headerRow = rows[0] || [];

  console.log(`\n========================================`);
  console.log(`SHEET: "${cfg.sheetName}"`);
  console.log("Installment Header Columns:");
  for (let c = cfg.instStartCol; c < Math.min(headerRow.length, cfg.instStartCol + 25); c++) {
    const rawVal = headerRow[c];
    const parsed = excelDateToDate(rawVal);
    console.log(`  Col ${c}: raw = ${rawVal} -> date = ${parsed}`);
  }
}
