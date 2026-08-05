import pg from 'pg';
const NEON = 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb';
const p = new pg.Pool({ connectionString: NEON, ssl:{rejectUnauthorized:false} });

// Check duplicates in Neon
const r = await p.query(`
  SELECT byaj_serial, COUNT(*) cnt, array_agg(id::text) ids
  FROM byaj_accounts
  GROUP BY byaj_serial
  HAVING COUNT(*) > 1
  ORDER BY byaj_serial LIMIT 10
`);
console.log('Neon duplicates by serial:', r.rows.length, 'sets');
if (r.rows.length) console.log('First 3:', r.rows.slice(0,3));

// Total count
const t = await p.query('SELECT COUNT(*)::int FROM byaj_accounts');
console.log('Total byaj_accounts:', t.rows[0].count);

await p.end();
