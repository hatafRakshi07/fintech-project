import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const cRes = await pool.query('SELECT * FROM customers LIMIT 5');
  console.log('Customers sample:', cRes.rows);

  const testMatch = await pool.query(`
    SELECT col.id as col_id, col.customer_id as col_cust_id, cust.id as cust_id, cust.name
    FROM collections col
    JOIN customers cust ON (cust.id::text = col.customer_id::text OR cust.reference_number::text = col.customer_id::text)
    LIMIT 5
  `);
  console.log('Customer match sample:', testMatch.rows);

  await pool.end();
}

run().catch(console.error);
