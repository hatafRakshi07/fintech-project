import xlsx from 'xlsx';
import path from 'path';

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx';
const wb = xlsx.readFile(filePath);

const requiredSheets = [
  'Sawariya seth 5 date',
  'Sawariya bissi 5 date gift shee',
  'Sawariya seth bissi gift record',
  'Pyare Mohan bissi gift sheets',
  'Pyare mohan 15 date',
  'Pyare mohan bissi gift records',
  'Hare ka sahara bissi gift sheet',
  'Hare ka sahara bissi maturity a',
  'Hare ka sahara bissi 20 date',
  'Hare ka sahara bissi gift recor',
  'Shree krishna gift sheet',
  'Shree Krishna associate lottery',
  'Shree krishna aasociates gift r',
  'Special customer token no in ea',
  'OUTER Customers list',
  ' monthly payment details',
  'other pending amounts',
  'Lucky Token list',
  'daily diary'
];

console.log("=== REQUIRED SHEETS ANALYSIS ===");

for (const sheetName of requiredSheets) {
  const actualName = wb.SheetNames.find(s => s.trim().toLowerCase() === sheetName.trim().toLowerCase());
  if (!actualName) {
    console.log(`❌ Sheet missing: "${sheetName}"`);
    continue;
  }
  const sheet = wb.Sheets[actualName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n----------------------------------------`);
  console.log(`Sheet: "${actualName}" | Rows: ${data.length}`);
  if (data.length > 0) {
    console.log(`Row 0 (Headers):`, data[0]?.slice(0, 10));
    if (data.length > 1) {
      console.log(`Row 1 (Sample):`, data[1]?.slice(0, 10));
    }
  }
}
