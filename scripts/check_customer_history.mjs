import pg from 'pg';
const { Client } = pg;

async function checkCustomer() {
  const client = new Client({ connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' });
  await client.connect();

  const custRes = await client.query("SELECT * FROM customers WHERE name ILIKE '%gaytri%' OR reference_number = 'BS-67-0772'");
  console.log('=== CUSTOMER ===');
  console.log(custRes.rows);

  if (custRes.rows.length > 0) {
    const custId = custRes.rows[0].id;
    const toksRes = await client.query(`
      SELECT 
        t.committee_id as "committeeId", 
        c.name as "committeeName", 
        c.type::text as "type", 
        c.installment_amount::float as "installment",
        ARRAY_REMOVE(ARRAY_AGG(t.token_number), NULL) as "tokens"
      FROM tokens t
      JOIN committees c ON t.committee_id = c.id
      WHERE t.customer_id = $1
      GROUP BY t.committee_id, c.name, c.type, c.installment_amount
    `, [custId]);

    console.log('=== MEMBERSHIPS FROM TOKENS TABLE ===');
    console.log(JSON.stringify(toksRes.rows, null, 2));

    const instsRes = await client.query(`
      SELECT * FROM installments WHERE customer_id = $1
    `, [custId]);
    console.log('=== INSTALLMENTS COUNT ===', instsRes.rows.length);
  }

  await client.end();
}

checkCustomer();
