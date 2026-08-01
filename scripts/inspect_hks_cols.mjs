import xlsx from 'xlsx';

const wb = xlsx.readFile('C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx');
const sheet = wb.Sheets['Hare ka sahara bissi gift sheet'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('Row 0:', data[0]);
console.log('Row 1:', data[1]);

data.slice(0, 20).forEach((r, i) => {
  if (r[2] || r[6]) {
    console.log(`Row ${i}: June-24 (Col 2)=${r[2]}, July-24 (Col 6)=${r[6]}`);
  }
});
