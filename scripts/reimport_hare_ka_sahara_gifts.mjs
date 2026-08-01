import xlsx from 'xlsx';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

function normalizeToken(t) {
  if (!t) return '';
  return String(t).trim().toUpperCase().replace(/^#/, '').replace(/\.0$/, '');
}

function normalizeStr(s) {
  if (!s) return '';
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

async function main() {
  console.log('=====================================================');
  console.log('RE-IMPORTING HARE KA SAHARA BISSI (ID 3) GIFTS (Starting June-24)');
  console.log('=====================================================');

  const client = await pool.connect();

  try {
    // 1. Clear old invalid gift records for Committee 3
    await client.query('DELETE FROM gift_distributions WHERE committee_id = 3');
    console.log('Cleared old gift records for Committee ID 3 (Hare Ka Sahara).');

    // 2. Fetch tokens and customers for Committee 3
    const tokensRes = await client.query('SELECT id, customer_id, token_number FROM tokens WHERE committee_id = 3');
    const tokenMap = new Map();
    for (const t of tokensRes.rows) {
      tokenMap.set(normalizeToken(t.token_number), { tokenId: t.id, customerId: t.customer_id });
    }

    const custsRes = await client.query('SELECT id, name FROM customers');
    const custNameMap = new Map();
    for (const c of custsRes.rows) custNameMap.set(normalizeStr(c.name), c.id);

    const giRes = await client.query('SELECT id, LOWER(name) as name FROM gift_inventory');
    const giftIdMap = new Map();
    for (const r of giRes.rows) giftIdMap.set(r.name, r.id);

    async function getOrCreateGiftId(name) {
      const norm = normalizeStr(name);
      if (!norm) return null;
      if (giftIdMap.has(norm)) return giftIdMap.get(norm);

      const ins = await client.query(`
        INSERT INTO gift_inventory (branch_id, name, quantity_total, quantity_available, quantity_distributed, status, created_at, updated_at)
        VALUES (1, $1, 500, 500, 0, 'active', NOW(), NOW())
        RETURNING id
      `, [name.trim()]);
      const id = ins.rows[0].id;
      giftIdMap.set(norm, id);
      return id;
    }

    // 3. Read sheet 'Hare ka sahara bissi gift sheet' from Bissi folder (1).xlsx
    const wb = xlsx.readFile('C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx');
    const sheet = wb.Sheets['Hare ka sahara bissi gift sheet'];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Detect month blocks from headers or rows
    const monthCols = [
      { monthName: 'June-24', dateStr: '2024-06-20', nameCol: 0, tokCol: 1, giftCol: 2 },
      { monthName: 'July-24', dateStr: '2024-07-20', nameCol: 4, tokCol: 5, giftCol: 6 },
      { monthName: 'August-24', dateStr: '2024-08-20', nameCol: 8, tokCol: 9, giftCol: 10 },
      { monthName: 'September-24', dateStr: '2024-09-20', nameCol: 12, tokCol: 13, giftCol: 14 },
      { monthName: 'October-24', dateStr: '2024-10-20', nameCol: 16, tokCol: 17, giftCol: 18 },
      { monthName: 'November-24', dateStr: '2024-11-20', nameCol: 20, tokCol: 21, giftCol: 22 },
      { monthName: 'December-24', dateStr: '2024-12-20', nameCol: 24, tokCol: 25, giftCol: 26 },
      { monthName: 'January-25', dateStr: '2025-01-20', nameCol: 28, tokCol: 29, giftCol: 30 }
    ];

    let insertedCount = 0;

    for (let rIdx = 1; rIdx < data.length; rIdx++) {
      const row = data[rIdx];
      if (!row || row.length === 0) continue;

      for (const m of monthCols) {
        const rawName = row[m.nameCol];
        const rawTok = row[m.tokCol];
        const rawGift = row[m.giftCol];

        if (!rawGift || String(rawGift).trim().length === 0) continue;
        const cleanGift = String(rawGift).trim();
        if (['Name', 'Token No:-', 'Gift Status', 'Gift status', '-'].includes(cleanGift)) continue;

        const normTok = normalizeToken(rawTok);
        let tokenInfo = normTok ? tokenMap.get(normTok) : null;
        let customerId = tokenInfo ? tokenInfo.customerId : null;
        let tokenId = tokenInfo ? tokenInfo.tokenId : null;

        if (!customerId && rawName) {
          customerId = custNameMap.get(normalizeStr(rawName));
        }

        if (!customerId && rawName && String(rawName).trim().length > 2) {
          const cleanN = String(rawName).trim();
          const insCust = await client.query(`
            INSERT INTO customers (name, mobile, reference_number, branch_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, 1, 'active', NOW(), NOW())
            RETURNING id
          `, [cleanN, `9000${Math.floor(100000 + Math.random() * 900000)}`, `REF-HKS-${Math.floor(1000 + Math.random() * 9000)}`]);
          customerId = insCust.rows[0].id;
          custNameMap.set(normalizeStr(cleanN), customerId);
        }

        // If customerId is not found but we have token number, assign to a default/placeholder customer for token
        if (!customerId && normTok) {
          const insCust = await client.query(`
            INSERT INTO customers (name, mobile, reference_number, branch_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, 1, 'active', NOW(), NOW())
            RETURNING id
          `, [`Token Member ${normTok}`, `9000${Math.floor(100000 + Math.random() * 900000)}`, `REF-HKS-TOK-${normTok}`]);
          customerId = insCust.rows[0].id;
        }

        if (!customerId) continue;

        if (!tokenId && normTok) {
          const insTok = await client.query(`
            INSERT INTO tokens (committee_id, customer_id, token_number, status, created_at)
            VALUES (3, $1, $2, 'active', NOW())
            RETURNING id
          `, [customerId, normTok]);
          tokenId = insTok.rows[0].id;
          tokenMap.set(normTok, { tokenId, customerId });
        }

        if (!tokenId) continue;

        const isCash = cleanGift.toLowerCase().includes('cash') || cleanGift.toLowerCase().includes('money');
        const claimMode = isCash ? 'CASH' : 'GIFT';
        const giftId = await getOrCreateGiftId(cleanGift);
        const notesStr = `Month: ${m.monthName} | Claim Mode = ${claimMode} | Gift: ${cleanGift}`;

        await client.query(`
          INSERT INTO gift_distributions (
            gift_id, customer_id, committee_id, token_id, quantity, distribution_date, status, notes, branch_id, created_at, updated_at
          ) VALUES ($1, $2, 3, $3, 1, $4::date, 'claimed', $5, 1, NOW(), NOW())
        `, [giftId, customerId, tokenId, m.dateStr, notesStr]);

        insertedCount++;
      }
    }

    console.log(`\n🎉 HARE KA SAHARA RE-IMPORT COMPLETE! Inserted ${insertedCount} clean gift records starting June-24.`);

    const resVer = await client.query(`
      SELECT DISTINCT notes, distribution_date
      FROM gift_distributions
      WHERE committee_id = 3
      ORDER BY distribution_date ASC
    `);
    console.log('\nUpdated Hare Ka Sahara Months in DB:');
    console.table(resVer.rows.slice(0, 15));

  } catch (err) {
    console.error('Error re-importing Hare Ka Sahara gifts:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
