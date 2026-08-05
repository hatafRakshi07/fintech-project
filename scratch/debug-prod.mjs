const PROD = 'https://fintech-project-tlgw.onrender.com';
// Check token statuses in production
const t = await fetch(`${PROD}/api/tokens?limit=5`).then(r=>r.json());
console.log('Token statuses:', t.tokens?.map(t => t.status));
// Check gifts error
const g = await fetch(`${PROD}/api/gifts`).then(async r => ({ status: r.status, body: (await r.text()).slice(0,200) }));
console.log('Gifts error:', g);
