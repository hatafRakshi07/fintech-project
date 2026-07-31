import pg from 'pg';
const { Client } = pg;

async function checkSchema() {
  const client = new Client({ connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' });
  await client.connect();

  const t1 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'gift_inventory' ORDER BY ordinal_position");
  const t2 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'gift_distributions' ORDER BY ordinal_position");
  const t3 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lotteries' ORDER BY ordinal_position");

  console.log('=== gift_inventory COLUMNS ===');
  console.table(t1.rows);
  console.log('=== gift_distributions COLUMNS ===');
  console.table(t2.rows);
  console.log('=== lotteries COLUMNS ===');
  console.table(t3.rows);

  await client.end();
}

checkSchema().catch(err => console.error(err));
