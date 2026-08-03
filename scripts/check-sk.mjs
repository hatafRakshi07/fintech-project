import XLSX from 'xlsx';

const wb = XLSX.readFile('C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx');
const sheet = wb.Sheets['Shree Krishna associate lottery'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('Top 30 rows of Shree Krishna associate lottery:');
rows.slice(0, 30).forEach((r, i) => {
  console.log(`Row ${i + 1}: Token=[${r[0]}] Name=[${r[1]}] Ref=[${r[2]}] Mob=[${r[3]}] RefMob=[${r[4]}] Notes=[${r[5]}]`);
});
