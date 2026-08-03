import xlsx from 'xlsx';

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx';
const wb = xlsx.readFile(filePath);

const sheetName = wb.SheetNames.find(s => s.trim().toLowerCase() === 'shree krishna associate lottery');
console.log("Found sheet:", sheetName);

if (sheetName) {
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  console.log("Total rows in Shree Krishna sheet:", rows.length);

  // Inspect headers
  console.log("Headers (Row 0):", rows[0]);

  // Inspect rows around row 115 to 130
  console.log("\n--- Rows 115 to 130 ---");
  for (let i = 115; i <= 130; i++) {
    if (rows[i]) {
      console.log(`Row ${i + 1}:`, rows[i].slice(0, 6));
    }
  }

  // Inspect Token #3 rows
  console.log("\n--- Searching for Token #3 entries ---");
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && (row[0] == 3 || String(row[0]).trim() === '3')) {
      console.log(`Row ${i + 1}:`, row.slice(0, 6));
    }
  }

  // Let's check all non-numeric or token > 1111 values in column 0
  console.log("\n--- Tokens > 1111 or unusual values ---");
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0] !== undefined && row[0] !== null) {
      const val = parseInt(String(row[0]).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(val) && val > 1111) {
        console.log(`Row ${i + 1}: raw_col0="${row[0]}" (parsed=${val}), Name="${row[1]}", Phone=${row[3] || row[4]}`);
      }
    }
  }
}
