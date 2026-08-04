import xlsx from 'xlsx';
const wb = xlsx.readFile('C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx');

const sheets = ['Sawariya seth 5 date', 'Pyare mohan 15 date', 'Hare ka sahara bissi 20 date', 'Shree Krishna associate lottery'];
for (const sn of sheets) {
  const actual = wb.SheetNames.find(s => s.trim().toLowerCase() === sn.toLowerCase());
  if (!actual) continue;
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[actual], { header: 1 });
  console.log(`\n=== ${actual} ===`);
  console.log("Headers:", rows[0]);
  console.log("Row 2 (sample):", rows[1]);
  console.log("Row 3 (sample):", rows[2]);
}
