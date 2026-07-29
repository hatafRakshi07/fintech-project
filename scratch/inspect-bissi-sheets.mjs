import xlsx from 'xlsx';

const file = 'C:/Users/lenovo/Downloads/Bissi folder (5).xlsx';
const wb = xlsx.readFile(file);

console.log("Sheet names in workbook:", wb.SheetNames);

const bissiSheets = [
  'Sawariya seth 5 date',
  'Pyare mohan 15 date',
  'Hare ka sahara bissi 20 date',
  'Shree Krishna associate lottery'
];

for (const name of wb.SheetNames) {
  if (bissiSheets.some(b => name.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(name.toLowerCase()))) {
    console.log(`\n========================================`);
    console.log(`SHEET: "${name}"`);
    const sheet = wb.Sheets[name];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log("Total rows:", json.length);
    console.log("Header / First 5 rows:");
    for (let i = 0; i < Math.min(6, json.length); i++) {
      console.log(`Row ${i}:`, json[i]);
    }
  }
}
