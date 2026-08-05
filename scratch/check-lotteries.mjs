const r = await fetch('https://fintech-project-tlgw.onrender.com/api/lotteries');
const j = await r.json();
console.log('total:', j.lotteries?.length, 'keys:', Object.keys(j));
if (j.lotteries?.[0]) console.log('first:', JSON.stringify(j.lotteries[0]).slice(0,300));
else console.log('response:', JSON.stringify(j).slice(0,300));
