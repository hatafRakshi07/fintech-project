import xlsx from 'xlsx';
const wb = xlsx.readFile('C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx');

const sheets = ['Sawariya seth 5 date', 'Pyare mohan 15 date', 'Hare ka sahara bissi 20 date', 'Shree Krishna associate lottery'];
for (const sn of sheets) {
  const actual = wb.SheetNames.find(s => s.trim().toLowerCase() === sn.toLowerCase());
  if (!actual) continue;
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[actual], { header: 1 });
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (let c = 5; c < row.length; c++) {
      const v = row[c];
      if (v !== undefined && v !== null) {
        const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 999999999) {
          console.log(`Sheet "${actual}" Row ${i+1} Col ${c}: ${v} (parsed: ${num}) Token: ${row[0]}`);
        }
      }
    }
  }
}
