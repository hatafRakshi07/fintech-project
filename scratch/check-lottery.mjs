const B = 'https://fintech-project-tlgw.onrender.com';
const tests = [
  '/api/lottery/dashboard',
  '/api/lottery/sessions',
];
for (const p of tests) {
  const r = await fetch(`${B}${p}`);
  const j = await r.json().catch(() => ({}));
  console.log(`${r.status} ${p}:`, JSON.stringify(j).slice(0, 150));
}
