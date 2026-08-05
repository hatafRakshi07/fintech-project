import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function repairDatabaseMappings() {
  console.log('[DATA REPAIR] Starting database mapping audit & repair...');

  try {
    // 1. Audit & Repair tokens customer_id mapping where raw_token_number matches customer
    const unmappedTokens = await pool.query(`
      SELECT COUNT(*)::int FROM tokens WHERE customer_id IS NULL OR customer_id::text = ''
    `);
    console.log(`[DATA REPAIR] Unmapped Tokens: ${unmappedTokens.rows[0].count}`);

    // 2. Audit & Repair collections customer_uuid / token_uuid mapping
    const unmappedCollectionsCust = await pool.query(`
      SELECT COUNT(*)::int FROM collections WHERE customer_uuid IS NULL
    `);
    console.log(`[DATA REPAIR] Collections missing customer_uuid: ${unmappedCollectionsCust.rows[0].count}`);

    // Repair collections.customer_uuid from customer_id integer if customer_id exists
    const repCollections1 = await pool.query(`
      UPDATE collections col
      SET customer_uuid = cust.id
      FROM customers cust
      WHERE col.customer_uuid IS NULL AND col.customer_id::text = cust.id::text
    `);
    console.log(`[DATA REPAIR] Collections repaired via customer_id match: ${repCollections1.rowCount}`);

    // Repair collections.committee_uuid from committee_id integer if committee_id exists
    const repCollections2 = await pool.query(`
      UPDATE collections col
      SET committee_uuid = comm.id
      FROM committees comm
      WHERE col.committee_uuid IS NULL AND col.committee_id::text = comm.id::text
    `);
    console.log(`[DATA REPAIR] Collections repaired via committee_id match: ${repCollections2.rowCount}`);

    // Repair collections.token_uuid by matching customer_uuid & committee_uuid to tokens
    const repCollections3 = await pool.query(`
      UPDATE collections col
      SET token_uuid = t.id
      FROM tokens t
      WHERE col.token_uuid IS NULL
        AND col.customer_uuid = t.customer_id
        AND col.committee_uuid = t.committee_id
    `);
    console.log(`[DATA REPAIR] Collections token_uuid linked: ${repCollections3.rowCount}`);

    // 3. Audit & Repair gift_distributions customer_uuid / committee_uuid / token_uuid
    const repGifts1 = await pool.query(`
      UPDATE gift_distributions gd
      SET customer_uuid = cust.id
      FROM customers cust
      WHERE gd.customer_uuid IS NULL AND gd.customer_id::text = cust.id::text
    `);
    console.log(`[DATA REPAIR] Gift distributions customer_uuid repaired: ${repGifts1.rowCount}`);

    const repGifts2 = await pool.query(`
      UPDATE gift_distributions gd
      SET committee_uuid = comm.id
      FROM committees comm
      WHERE gd.committee_uuid IS NULL AND gd.committee_id::text = comm.id::text
    `);
    console.log(`[DATA REPAIR] Gift distributions committee_uuid repaired: ${repGifts2.rowCount}`);

    const repGifts3 = await pool.query(`
      UPDATE gift_distributions gd
      SET token_uuid = t.id
      FROM tokens t
      WHERE gd.token_uuid IS NULL
        AND gd.customer_uuid = t.customer_id
        AND gd.committee_uuid = t.committee_id
    `);
    console.log(`[DATA REPAIR] Gift distributions token_uuid linked: ${repGifts3.rowCount}`);

    // 4. Audit & Repair lotteries winner_customer_uuid / committee_uuid
    const repLotteries1 = await pool.query(`
      UPDATE lotteries l
      SET winner_customer_uuid = cust.id
      FROM customers cust
      WHERE l.winner_customer_uuid IS NULL AND l.winner_id::text = cust.id::text
    `);
    console.log(`[DATA REPAIR] Lotteries winner_customer_uuid repaired: ${repLotteries1.rowCount}`);

    const repLotteries2 = await pool.query(`
      UPDATE lotteries l
      SET committee_uuid = comm.id
      FROM committees comm
      WHERE l.committee_uuid IS NULL AND l.committee_id::text = comm.id::text
    `);
    console.log(`[DATA REPAIR] Lotteries committee_uuid repaired: ${repLotteries2.rowCount}`);

    // 5. Final validation summary
    const summary = await pool.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM committees) as committees,
        (SELECT COUNT(*)::int FROM customers) as customers,
        (SELECT COUNT(*)::int FROM tokens) as tokens,
        (SELECT COUNT(*)::int FROM collections WHERE customer_uuid IS NOT NULL) as collections_with_customer,
        (SELECT COUNT(*)::int FROM gift_distributions WHERE customer_uuid IS NOT NULL) as gifts_with_customer,
        (SELECT COUNT(*)::int FROM byaj_accounts) as byaj_accounts,
        (SELECT COUNT(*)::int FROM byaj_payments) as byaj_payments,
        (SELECT COUNT(*)::int FROM lotteries WHERE winner_customer_uuid IS NOT NULL) as lotteries_with_winner
    `);

    console.log('=== DATA INTEGRITY AUDIT SUMMARY ===');
    console.table(summary.rows[0]);

  } catch (err) {
    console.error('[DATA REPAIR ERROR]', err.message);
  } finally {
    await pool.end();
  }
}

repairDatabaseMappings().catch(console.error);
