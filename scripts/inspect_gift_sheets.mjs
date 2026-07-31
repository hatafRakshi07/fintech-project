import xlsx from 'xlsx';

const WORKBOOK_PATH = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx';
const wb = xlsx.readFile(WORKBOOK_PATH);

const giftSheets = wb.SheetNames.filter(s => {
  const lower = s.toLowerCase();
  return lower.includes('gift') || lower.includes('lottery') || lower.includes('lucky');
});

console.log('=== GIFT RELATED WORKSHEETS FOUND ===');
console.log(giftSheets);

for (const name of giftSheets) {
  console.log(`\n======================================================`);
  console.log(`WORKSHEET: "${name}"`);
  console.log(`======================================================`);
  const sheet = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(sheet);
  console.log(`Total Rows: ${rows.length}`);
  if (rows.length > 0) {
    console.log('Sample Row 1:');
    console.log(rows[0]);
  }
}
