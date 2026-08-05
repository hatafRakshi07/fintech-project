const B = 'http://localhost:5005';
const tests = [
  ['/api/dashboard/stats', r => `customers=${r.totalCustomers}, collections=${r.totalCollections}`],
  ['/api/v2/dashboard', r => `today=${r.today?.totalCollection}, pending_byaj=${r.pending?.byajCount}`],
  ['/api/interests/accounts', r => `accounts=${r.total}`],
  ['/api/interests/pending', r => `pending=${r.total}`],
  ['/api/v2/mi/accounts', r => `mi_accounts=${r.total}`],
  ['/api/v2/mi/pending', r => `mi_pending=${r.total}`],
  ['/api/loans/summary', r => `totalLoans=${r.totalLoans}, active=${r.activeLoans}`],
  ['/api/loans', r => `loans=${r.total}`],
  ['/api/reports/collection', r => `total=${r.summary?.total}, count=${r.summary?.count}`],
  ['/api/reports/loan', r => `statuses=${r.data?.length}`],
  ['/api/daily-diary', r => `ddLoans=${r.total}`],
  ['/api/v2/customer-search?q=brijesh', r => `results=${r.results?.length}`],
  ['/api/v2/ledger/monthly-summary', r => `modules=${r.summary?.length}`],
  ['/api/customers?limit=3', r => `total=${r.total}`],
  ['/api/committees', r => `committees=${r.committees?.length}`],
];

for (const [path, fmt] of tests) {
  try {
    const res = await fetch(`${B}${path}`);
    const j = await res.json();
    const info = j.success !== false ? fmt(j) : `ERROR: ${j.error}`;
    console.log(`${res.ok ? '✓' : '✗'} ${path.padEnd(40)} ${info}`);
  } catch(e) {
    console.log(`✗ ${path.padEnd(40)} ${e.message}`);
  }
}
