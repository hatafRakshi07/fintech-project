import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const monthMap = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

const committeeDrawDays = {
  1: 5,   // Sawariya Seth: 5th of month
  4: 10,  // Shree Krishna: 10th of month
  2: 15,  // Pyare Mohan: 15th of month
  3: 20   // Hare Ka Sahara: 20th of month
};

function parseMonthToDate(notesStr, committeeId) {
  if (!notesStr) return null;
  const mMatch = notesStr.match(/Month:\s*([^|]+)/i);
  if (!mMatch) return null;

  const rawMonth = mMatch[1].trim().toLowerCase();
  let mNum = null;
  let year = null;

  for (const [key, num] of Object.entries(monthMap)) {
    if (rawMonth.includes(key)) {
      mNum = num;
      break;
    }
  }

  const yMatch = rawMonth.match(/(\d{2,4})/);
  if (yMatch) {
    const yVal = parseInt(yMatch[1], 10);
    if (yVal < 100) year = 2000 + yVal;
    else year = yVal;
  }

  if (!mNum || !year) return null;

  const drawDay = committeeDrawDays[committeeId] || 5;
  return `${year}-${String(mNum).padStart(2, '0')}-${String(drawDay).padStart(2, '0')}`;
}

async function main() {
  console.log('=====================================================');
  console.log('FAST BATCH UPDATING EXACT DATE-WISE DISTRIBUTION DATES');
  console.log('=====================================================');

  const client = await pool.connect();

  try {
    const res = await client.query('SELECT id, committee_id, notes FROM gift_distributions');
    console.log(`Processing ${res.rows.length} rows...`);

    const updates = [];
    for (const r of res.rows) {
      const d = parseMonthToDate(r.notes, r.committee_id);
      if (d) {
        updates.push({ id: r.id, date: d });
      }
    }

    console.log(`Extracted valid dates for ${updates.length} rows.`);

    // Batch update using CASE statement in chunks of 500
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = updates.slice(i, i + 500);
      const caseClauses = chunk.map(u => `WHEN ${u.id} THEN '${u.date}'::date`).join(' ');
      const ids = chunk.map(u => u.id).join(',');

      await client.query(`
        UPDATE gift_distributions
        SET distribution_date = CASE id ${caseClauses} END
        WHERE id IN (${ids})
      `);
    }

    console.log(`\n🎉 FAST BATCH DATE UPDATE COMPLETE! Updated ${updates.length} records.`);

    // Verify sample date-wise sorted output
    const sampleRes = await client.query(`
      SELECT c.name as comm_name, gd.notes, gd.distribution_date::text as exact_date
      FROM gift_distributions gd
      JOIN committees c ON c.id = gd.committee_id
      ORDER BY gd.distribution_date ASC
      LIMIT 15
    `);
    console.log('\nSample Date-Wise Sorted Gift Records:');
    console.table(sampleRes.rows);

  } catch (err) {
    console.error('Error during batch date update:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
