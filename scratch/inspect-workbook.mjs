import XLSX from 'xlsx';

const wb = XLSX.readFile('c:/Users/iSN_kota_T52/Desktop/fintech-project/Bissi.xlsx');
console.log('=== ALL SHEETS ===');
console.log(wb.SheetNames.join('\n'));

// Key sheets we care about
const KEY = ['MONTHLY INSTALLMENT', 'BYAJ KI LIST', ' monthly payment details', 'OUTER Customers list'];

for (const name of KEY) {
  const ws = wb.Sheets[name];
  if (!ws) { console.log(`\n!! NOT FOUND: "${name}"`); continue; }
  const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  const header = rows[0] || [];
  const sample = rows.slice(1, 4);
  console.log(`\n========== ${name} (${rows.length - 1} data rows) ==========`);
  console.log('HEADERS:', header.map((h,i) => `[${i}] ${h}`).join('\n        '));
  console.log('SAMPLE ROW 1:', sample[0]);
  console.log('SAMPLE ROW 2:', sample[1]);
}

// Also check bissi member sheets for token/customer structure
const BISSI = ['Sawariya seth 5 date', 'Pyare mohan 15 date', 'Hare ka sahara bissi 20 date', 'Shree Krishna associate lottery'];
for (const name of BISSI) {
  const ws = wb.Sheets[name];
  if (!ws) continue;
  const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  const header = rows[0] || [];
  const sample = rows.slice(1, 3);
  console.log(`\n=== ${name} ===`);
  console.log('HEADERS:', header.slice(0, 10).join(' | '));
  console.log('SAMPLE:', JSON.stringify(sample[0]?.slice?.(0,10) ?? sample[0]));
}
