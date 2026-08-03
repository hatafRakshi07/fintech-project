import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',ssl:{rejectUnauthorized:false}});

// Check employees table
const empCols = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='employees' ORDER BY ordinal_position");
console.log('employees columns:', empCols.rows.map(r=>`${r.column_name}(${r.data_type})`).join(', '));
const empCount = await p.query('SELECT count(*) FROM employees');
console.log('employees count:', empCount.rows[0].count);
const empSample = await p.query('SELECT * FROM employees LIMIT 5');
if (empSample.rows.length) empSample.rows.forEach(r=>console.log('emp:', JSON.stringify(r)));

// Check gift_distributions
const gdCount = await p.query('SELECT count(*) FROM gift_distributions WHERE committee_uuid IS NOT NULL');
console.log('\ngift_distributions (with uuid):', gdCount.rows[0].count);
const gdSample = await p.query(`
  SELECT gd.id, gd.gift_name, gd.token_number, gd.customer_name, gd.status::text, gd.distribution_date, comm.name as committee
  FROM gift_distributions gd
  LEFT JOIN committees comm ON comm.id = gd.committee_uuid
  WHERE gd.committee_uuid IS NOT NULL
  LIMIT 5
`);
console.log('\ngift_distributions sample:');
gdSample.rows.forEach(r=>console.log(' ',JSON.stringify(r)));

// Check collections with collector_id
const colWithCollector = await p.query('SELECT count(*) FROM collections WHERE committee_uuid IS NOT NULL');
console.log('\ncollections count:', colWithCollector.rows[0].count);

await p.end();
