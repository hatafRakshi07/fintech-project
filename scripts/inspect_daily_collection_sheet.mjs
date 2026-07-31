import xlsx from 'xlsx';

const wb = xlsx.readFile('C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx');
const sheet = wb.Sheets['Daily collection'];
const data = xlsx.utils.sheet_to_json(sheet);

console.log('Total rows in Daily collection:', data.length);

const gaytriRows = data.filter(r => {
  const name = String(r['Name'] || r['name'] || '').toLowerCase();
  const reason = String(r['REASON'] || r['reason'] || '').toLowerCase();
  const empty = String(r['__EMPTY'] || '').toLowerCase();
  return name.includes('gaytri') || name.includes('gaitri') || reason.includes('25') || empty.includes('25');
});

console.log('Gaytri / Token 25 sample rows in Daily collection:');
console.log(gaytriRows.slice(0, 10));
