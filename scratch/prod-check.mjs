const B = 'https://fintech-project-tlgw.onrender.com';
const tests = [
  ['/api/dashboard/stats',           r => `customers=${r.totalCustomers}, collections=${r.totalCollections}`],
  ['/api/committees',                r => `committees=${r.committees?.length}, first_tokens=${r.committees?.[0]?.totalTokens}`],
  ['/api/customers?limit=1',         r => `total=${r.total}`],
  ['/api/collections?limit=1',       r => `count=${r.Count ?? r.total}`],
  ['/api/tokens?limit=1',            r => `success=${r.success}`],
  ['/api/interests/accounts?limit=1',r => `total=${r.total}, name=${r.accounts?.[0]?.customerName}`],
  ['/api/v2/dashboard',              r => `byaj_pending=${r.pending?.byajCount}`],
  ['/api/loans/summary',             r => `total=${r.totalLoans}`],
  ['/api/reports/collection',        r => `count=${r.summary?.count}`],
  ['/api/daily-diary',               r => `loans=${r.total}`],
  ['/api/lotteries',                 r => `count=${r.lotteries?.length ?? 0}`],
  ['/api/gifts',                     r => `count=${r.gifts?.length ?? 0}`],
];
for (const [path, fmt] of tests) {
  try {
    const res = await fetch(`${B}${path}`);
    const j = await res.json();
    const info = res.ok ? fmt(j) : `ERROR ${res.status}`;
    console.log(`${res.ok ? '✓' : '✗'} ${path.padEnd(38)} ${info}`);
  } catch(e) {
    console.log(`✗ ${path.padEnd(38)} ${e.message}`);
  }
}
