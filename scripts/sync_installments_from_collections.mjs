import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=====================================================');
  console.log('SYNCING INSTALLMENTS TABLE FROM COLLECTIONS TABLE');
  console.log('=====================================================');

  const client = await pool.connect();

  try {
    // 1. Delete old "Daily Collection by Aryan Sir" rows from installments table
    const delRes = await client.query("DELETE FROM installments WHERE remarks ILIKE '%Daily Collection by Aryan Sir%'");
    console.log(`Deleted ${delRes.rowCount} Daily Collection rows from installments table.`);

    // 2. Fetch all collections rows (which have 22,944 Bissi Monthly Installments)
    const colsRes = await client.query(`
      SELECT customer_id, committee_id, amount, payment_mode, notes as remarks, collected_at
      FROM collections
      WHERE notes ILIKE '%Bissi Monthly Installment%'
    `);

    console.log(`Found ${colsRes.rows.length} Bissi Monthly Installment rows in collections table.`);

    // 3. Clear existing Bissi Monthly Installment rows in installments table to allow clean sync
    await client.query("DELETE FROM installments WHERE remarks ILIKE '%Bissi Monthly Installment%'");

    // 4. Bulk insert into installments table in chunks of 500
    const rows = colsRes.rows;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const valueStrings = [];
      const params = [];

      chunk.forEach((item, idx) => {
        const offset = idx * 8;
        const dt = new Date(item.collected_at || '2026-06-15');
        const monthNum = dt.getMonth() + 1;
        const yearNum = dt.getFullYear();

        valueStrings.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}::timestamp)`);
        params.push(item.customer_id, item.committee_id, monthNum, yearNum, item.amount, (item.payment_mode || 'cash').toLowerCase(), item.remarks, item.collected_at);
      });

      const query = `
        INSERT INTO installments (customer_id, committee_id, month, year, amount, payment_mode, remarks, payment_date)
        VALUES ${valueStrings.join(', ')}
      `;
      await client.query(query, params);
      totalInserted += chunk.length;
    }

    console.log(`✅ Bulk inserted ${totalInserted} rows into installments table.`);

    const finalInstCount = await client.query("SELECT COUNT(*)::int as total FROM installments");
    console.log(`🎉 Total rows in installments table now: ${finalInstCount.rows[0].total}`);

  } catch (err) {
    console.error('Error syncing installments table:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
