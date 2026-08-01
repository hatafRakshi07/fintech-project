import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testMatrix(committeeId) {
  const commRes = await pool.query('SELECT name FROM committees WHERE id = $1', [committeeId]);
  const cName = commRes.rows[0]?.name || `Committee ${committeeId}`;

  const giftsRes = await pool.query(`
    SELECT 
      gd.token_id::text as "tokenId",
      gd.notes,
      gi.name as gift_name,
      gd.distribution_date
    FROM gift_distributions gd
    LEFT JOIN gift_inventory gi ON gi.id = gd.gift_id
    WHERE gd.committee_id = $1
    ORDER BY gd.distribution_date ASC, gd.id ASC
  `, [committeeId]);

  const monthMap = new Map();
  for (const g of giftsRes.rows) {
    const notes = g.notes || '';
    const mMatch = notes.match(/Month:\s*([^|]+)/i);
    let monthLabel = mMatch ? mMatch[1].trim() : '';
    if (!monthLabel) continue;
    
    // Normalize format e.g. 'April-25' -> 'Apr-25'
    monthLabel = monthLabel.replace(/January/i, 'Jan')
                           .replace(/February/i, 'Feb')
                           .replace(/March/i, 'Mar')
                           .replace(/April/i, 'Apr')
                           .replace(/June/i, 'Jun')
                           .replace(/July/i, 'Jul')
                           .replace(/August/i, 'Aug')
                           .replace(/September/i, 'Sep')
                           .replace(/Septmber/i, 'Sep')
                           .replace(/October/i, 'Oct')
                           .replace(/November/i, 'Nov')
                           .replace(/December/i, 'Dec')
                           .replace(/\s+/g, '');

    if (!monthMap.has(monthLabel)) {
      monthMap.set(monthLabel, g.distribution_date);
    }
  }

  console.log(`\n=== Committee ID ${committeeId}: ${cName} ===`);
  console.log('Dynamic Months (Chronological):', Array.from(monthMap.keys()));
}

async function run() {
  await testMatrix(1); // Sawariya Seth
  await testMatrix(2); // Pyare Mohan
  await testMatrix(3); // Hare Ka Sahara
  await testMatrix(4); // Shree Krishna
  await pool.end();
}

run().catch(console.error);
