import pg from 'pg';
const { Client } = pg;

async function testFullHistory() {
  const client = new Client({ connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' });
  await client.connect();

  const customerId = 67;

  const [installmentsRes, membershipsCountRes, tokensCountRes, giftsCountRes, membershipsRes, tokensRes, collectionsQueryRes] = await Promise.all([
    client.query('SELECT COALESCE(SUM(amount), 0)::float as total_paid, COUNT(*)::int as total_installments FROM installments WHERE customer_id = $1', [customerId]),
    client.query('SELECT COUNT(DISTINCT committee_id)::int as count FROM tokens WHERE customer_id = $1', [customerId]),
    client.query('SELECT COUNT(*)::int as count FROM tokens WHERE customer_id = $1', [customerId]),
    client.query('SELECT COUNT(*)::int as count FROM gift_distributions WHERE customer_id = $1', [customerId]),
    client.query(`
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
    `, [customerId]),
    client.query('SELECT id, token_number as "tokenNumber", status::text FROM tokens WHERE customer_id = $1', [customerId]),
    client.query(`
      SELECT 
        id, 
        amount::float, 
        payment_date as "date", 
        payment_mode::text as "paymentMode", 
        remarks as "notes" 
      FROM installments 
      WHERE customer_id = $1 
      ORDER BY payment_date DESC
    `, [customerId]),
  ]);

  const summary = {
    totalPaid: installmentsRes.rows[0].total_paid,
    totalCollections: installmentsRes.rows[0].total_installments,
    committeesJoined: membershipsCountRes.rows[0].count,
    totalTokens: tokensCountRes.rows[0].count,
    totalGifts: giftsCountRes.rows[0].count,
  };

  console.log('=== GAYTRI JI (ID 67) FULL SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('=== MEMBERSHIPS ===');
  console.log(JSON.stringify(membershipsRes.rows, null, 2));
  console.log('=== PAYMENTS LIST ===');
  console.log(JSON.stringify(collectionsQueryRes.rows, null, 2));

  await client.end();
}

testFullHistory().catch(err => console.error(err));
