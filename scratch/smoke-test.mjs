// Quick smoke test — hits every GET endpoint, collects status + error
const BASE = 'http://localhost:5002';

const endpoints = [
  '/api/dashboard/stats',
  '/api/v2/dashboard/summary',
  '/api/v2/dashboard/available-months',
  '/api/customers?limit=3',
  '/api/customers?limit=3&search=test',
  '/api/tokens?limit=3',
  '/api/committees',
  '/api/collections?limit=3',
  '/api/branches',
  '/api/collectors',
  '/api/lotteries',
  '/api/gifts',
  '/api/v2/collections/recent',
  '/api/v2/collector/dashboard',
  '/api/daily-diary',
  '/api/office/diary',
  '/api/office/tasks',
  '/api/office/expenses',
  '/api/office/donations',
  '/api/notifications',
  '/api/notifications/unread-count',
  '/api/healthz',
];

for (const path of endpoints) {
  try {
    const res = await fetch(`${BASE}${path}`);
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 80); }
    const ok = res.ok ? '✓' : '✗';
    const err = !res.ok ? ` → ${body?.error ?? body?.message ?? res.statusText}` : '';
    console.log(`${ok} ${res.status} ${path}${err}`);
  } catch (e) {
    console.log(`✗ ERR ${path} → ${e.message}`);
  }
}
