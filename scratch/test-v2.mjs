const BASE = 'http://localhost:5004';
const endpoints = [
  '/api/loans/summary',
  '/api/loans',
  '/api/reports/collection',
  '/api/reports/loan',
  '/api/daily-diary',
  '/api/interests/summary',
  '/api/interests/accounts',
  '/api/v2/dashboard',
  '/api/v2/mi/accounts',
  '/api/v2/byaj/accounts',
  '/api/v2/customer-search?q=brijesh',
  '/api/v2/ledger/monthly-summary',
];
for (const p of endpoints) {
  try {
    const r = await fetch(`${BASE}${p}`);
    const j = await r.json();
    console.log(`${r.ok ? '✓' : '✗'} ${r.status} ${p}`);
  } catch(e) {
    console.log(`✗ ERR ${p} → ${e.message}`);
  }
}
