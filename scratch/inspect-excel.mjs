import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const downloadsDir = 'C:\\Users\\lenovo\\Downloads';
const files = fs.readdirSync(downloadsDir).filter(f => f.toLowerCase().includes('bissi') && f.endsWith('.xlsx'));

console.log("Found Bissi Excel files in Downloads:", files);

for (const file of files) {
  const filePath = path.join(downloadsDir, file);
  console.log(`\n========================================`);
  console.log(`File: ${filePath}`);
  try {
    const workbook = xlsx.readFile(filePath, { bookSheets: true });
    console.log("Sheet names count:", workbook.SheetNames.length);
    console.log("Sheet names:", workbook.SheetNames);
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
}
