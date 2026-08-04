import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const custCol = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'customers'
  `);
  console.log("customers Columns:", custCol.rows);

  const sampleCust = await pool.query("SELECT * FROM customers LIMIT 1");
  console.log("sample customer:", sampleCust.rows[0]);

  await pool.end();
}

run().catch(console.error);
