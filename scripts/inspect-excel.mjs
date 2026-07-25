import XLSX from 'xlsx';

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx';
console.log('Reading Excel file:', filePath);

const workbook = XLSX.readFile(filePath);
console.log('Sheet names in Excel workbook:', workbook.SheetNames);

workbook.SheetNames.forEach((sheetName, index) => {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n--- Sheet ${index + 1}: "${sheetName}" ---`);
  console.log(`Total rows: ${rows.length}`);
  if (rows.length > 0) {
    console.log('Header / First 3 rows:');
    console.log(rows.slice(0, 5));
  }
});
