import urllib.request, json
BASE = 'https://fintech-project-tlgw.onrender.com'
try:
    r = urllib.request.urlopen(BASE + '/api/daily-diary/loans', timeout=30)
    data = json.loads(r.read().decode())
    loans = data.get('loans', [])
    print(f'Loans returned: {len(loans)}')
    for l in loans[:5]:
        print(f'  {l.get("customerName")} | amt:{l.get("loanAmount")} | status:{l.get("status")} | remaining:{l.get("remainingAmount")}')
except Exception as e:
    print('API error:', e)

try:
    r2 = urllib.request.urlopen(BASE + '/api/daily-diary/dashboard', timeout=30)
    d2 = json.loads(r2.read().decode())
    stats = d2.get('stats', {})
    print(f'\nDashboard stats: totalLoans={stats.get("totalLoans")}, active={stats.get("activeLoans")}, collected={stats.get("totalAmountCollected")}')
except Exception as e:
    print('Dashboard API error:', e)

try:
    r3 = urllib.request.urlopen(BASE + '/api/interests/accounts', timeout=30)
    d3 = json.loads(r3.read().decode())
    print(f'\nInterest accounts: {len(d3.get("data",[]) or d3.get("accounts",[]) or [])}')
except Exception as e:
    print('Interests API error:', e)
