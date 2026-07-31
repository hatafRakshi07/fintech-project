import pg from 'pg';
const { Client } = pg;

async function verifyProof() {
  const client = new Client({ connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' });
  await client.connect();

  console.log('=====================================================================');
  console.log('VERIFYING CUSTOMER PAYMENT HISTORIES IN PRODUCTION DATABASE');
  console.log('=====================================================================');

  const nitin = await client.query("SELECT id, name, mobile, reference_number FROM customers WHERE name ILIKE '%nitin%'");
  console.log('\n--- CUSTOMER: Nitin Sisodiya ---');
  console.table(nitin.rows);

  if (nitin.rows.length > 0) {
    const nitinId = nitin.rows[0].id;
    const nitinInsts = await client.query(`
      SELECT 
        i.id, 
        c.name as "committeeName", 
        t.token_number as "tokenNumber", 
        i.amount::numeric as "amount", 
        i.payment_date as "date", 
        i.payment_mode as "paymentMode", 
        i.remarks
      FROM installments i
      LEFT JOIN committees c ON c.id = i.committee_id
      LEFT JOIN tokens t ON t.id = i.token_id
      WHERE i.customer_id = $1
      ORDER BY i.payment_date DESC
    `, [nitinId]);
    console.log(`Payment History Records for Nitin Sisodiya (${nitinInsts.rows.length} records):`);
    console.table(nitinInsts.rows);
  }

  const gaytri = await client.query("SELECT id, name, mobile, reference_number FROM customers WHERE reference_number = 'BS-67-0772'");
  console.log('\n--- CUSTOMER: Gaytri ji (BS-67-0772) ---');
  console.table(gaytri.rows);

  if (gaytri.rows.length > 0) {
    const gaytriId = gaytri.rows[0].id;
    const gaytriInsts = await client.query(`
      SELECT 
        i.id, 
        c.name as "committeeName", 
        t.token_number as "tokenNumber", 
        i.amount::numeric as "amount", 
        i.payment_date as "date", 
        i.payment_mode as "paymentMode", 
        i.remarks
      FROM installments i
      LEFT JOIN committees c ON c.id = i.committee_id
      LEFT JOIN tokens t ON t.id = i.token_id
      WHERE i.customer_id = $1
      ORDER BY i.payment_date DESC
    `, [gaytriId]);
    console.log(`Payment History Records for Gaytri ji (${gaytriInsts.rows.length} records):`);
    console.table(gaytriInsts.rows);
  }

  await client.end();
}

verifyProof().catch(err => console.error(err));
