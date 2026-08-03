import XLSX from 'xlsx';

const workbook = XLSX.readFile('C:\\Users\\lenovo\\Downloads\\Bissi.xlsx');

console.log("=== SHEET COLUMNS IN Bissi.xlsx ===");
workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = rows[0] || [];
  console.log(`\nSheet [${sheetName}] (${rows.length} rows):`);
  console.log(`  Headers:`, headers.slice(0, 15));
});
