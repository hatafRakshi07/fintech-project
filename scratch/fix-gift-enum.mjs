import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',ssl:{rejectUnauthorized:false}});

// Check actual enum values for gift_distribution_status
const enumVals = await p.query(`
  SELECT enumlabel FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'gift_distribution_status'
  ORDER BY e.enumsortorder
`);
console.log('gift_distribution_status values:', enumVals.rows.map(r=>r.enumlabel));

// Add 'distributed' if missing
const hasDistributed = enumVals.rows.some(r => r.enumlabel === 'distributed');
if (!hasDistributed) {
  console.log('Adding distributed to enum...');
  await p.query("ALTER TYPE gift_distribution_status ADD VALUE IF NOT EXISTS 'distributed'");
  console.log('Done!');
} else {
  console.log('distributed already exists');
}

await p.end();
