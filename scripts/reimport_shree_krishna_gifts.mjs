import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

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
  console.log('RE-IMPORTING SHREE KRISHNA BISSI (ID 4) GIFTS (Starting June-26)');
  console.log('=====================================================');

  const client = await pool.connect();

  try {
    // 1. Clear old invalid gift distribution records for Committee 4
    await client.query('DELETE FROM gift_distributions WHERE committee_id = 4');
    console.log('Cleared old invalid gift records for Committee ID 4 (Shree Krishna).');

    // 2. Fetch tokens and customers for Committee 4
    const tokensRes = await client.query('SELECT id, customer_id, token_number FROM tokens WHERE committee_id = 4');
    const tokenMap = new Map(); // tokenNumber -> { tokenId, customerId }
    for (const t of tokensRes.rows) {
      tokenMap.set(normalizeToken(t.token_number), { tokenId: t.id, customerId: t.customer_id });
    }

    const custsRes = await client.query('SELECT id, name FROM customers');
    const custNameMap = new Map();
    for (const c of custsRes.rows) {
      custNameMap.set(normalizeStr(c.name), c.id);
    }

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

    // 3. Process CSV 1: "Bissi folder - Shree krishna gift sheet.csv"
    const f1 = 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Shree krishna gift sheet.csv';
    let insertedCount = 0;

    if (fs.existsSync(f1)) {
      console.log(`Processing file: ${path.basename(f1)}`);
      const lines = fs.readFileSync(f1, 'utf8').split('\n').filter(l => l.trim().length > 0);
      
      // Line 0: June-26,,, ,,July-26,,,,August-26,
      // Line 1: Name,Token no,Gift status,,Name,Token no,Gift status,,Name,token no,Gift status
      const headerRow0 = parseCSVLine(lines[0]);
      const headerRow1 = parseCSVLine(lines[1]);

      // Detect month blocks (June-26, July-26, August-26, September-26, October-26, November-26...)
      const monthBlocks = [];
      for (let i = 0; i < headerRow1.length; i++) {
        const col = headerRow1[i].toLowerCase();
        if (col.includes('token')) {
          // Find month name from row 0 or row 1
          let monthName = headerRow0[i - 1] || headerRow0[i] || headerRow0[i + 1] || '';
          if (!monthName) {
            for (let k = i; k >= 0; k--) {
              if (headerRow0[k]) { monthName = headerRow0[k]; break; }
            }
          }
          monthBlocks.push({ nameCol: i - 1, tokCol: i, statusCol: i + 1, monthName: monthName.trim() || 'June-26' });
        }
      }

      console.log('Detected Month Blocks in File 1:', monthBlocks);

      // Month to exact date mapping for Shree Krishna (10th Date)
      const monthDateMap = {
        'June-26': '2026-06-10',
        'Jun-26': '2026-06-10',
        'July-26': '2026-07-10',
        'Jul-26': '2026-07-10',
        'August-26': '2026-08-10',
        'Aug-26': '2026-08-10',
        'September-26': '2026-09-10',
        'Sep-26': '2026-09-10',
        'October-26': '2026-10-10',
        'Oct-26': '2026-10-10',
        'November-26': '2026-11-10',
        'Nov-26': '2026-11-10',
        'December-26': '2026-12-10',
        'Dec-26': '2026-12-10'
      };

      for (let rIdx = 2; rIdx < lines.length; rIdx++) {
        const row = parseCSVLine(lines[rIdx]);
        if (!row || row.length === 0) continue;

        for (const block of monthBlocks) {
          const rawName = row[block.nameCol];
          const rawTok = row[block.tokCol];
          const rawStatus = row[block.statusCol];

          if (!rawStatus || rawStatus.trim().length === 0) continue;
          const cleanStatus = rawStatus.trim();
          if (['Name', 'Token', 'Gift status', '-'].includes(cleanStatus)) continue;

          const normTok = normalizeToken(rawTok);
          let tokenInfo = normTok ? tokenMap.get(normTok) : null;
          let customerId = tokenInfo ? tokenInfo.customerId : null;
          let tokenId = tokenInfo ? tokenInfo.tokenId : null;

          if (!customerId && rawName) {
            customerId = custNameMap.get(normalizeStr(rawName));
          }

          if (!customerId && rawName && rawName.trim().length > 2) {
            const cleanN = rawName.trim();
            const insCust = await client.query(`
              INSERT INTO customers (name, mobile, reference_number, branch_id, status, created_at, updated_at)
              VALUES ($1, $2, $3, 1, 'active', NOW(), NOW())
              RETURNING id
            `, [cleanN, `9000${Math.floor(100000 + Math.random() * 900000)}`, `REF-SK-${Math.floor(1000 + Math.random() * 9000)}`]);
            customerId = insCust.rows[0].id;
            custNameMap.set(normalizeStr(cleanN), customerId);
          }

          if (!customerId) continue;

          if (!tokenId && normTok) {
            const insTok = await client.query(`
              INSERT INTO tokens (committee_id, customer_id, token_number, status, created_at)
              VALUES (4, $1, $2, 'active', NOW())
              RETURNING id
            `, [customerId, normTok]);
            tokenId = insTok.rows[0].id;
            tokenMap.set(normTok, { tokenId, customerId });
          }

          if (!tokenId) continue;

          const mDate = monthDateMap[block.monthName] || '2026-06-10';
          const isCash = cleanStatus.toLowerCase().includes('cash') || cleanStatus.toLowerCase().includes('money');
          const claimMode = isCash ? 'CASH' : 'GIFT';
          const giftId = await getOrCreateGiftId(cleanStatus);

          const notesStr = `Month: ${block.monthName} | Claim Mode = ${claimMode} | Gift: ${cleanStatus}`;

          await client.query(`
            INSERT INTO gift_distributions (
              gift_id, customer_id, committee_id, token_id, quantity, distribution_date, status, notes, branch_id, created_at, updated_at
            ) VALUES ($1, $2, 4, $3, 1, $4::date, 'claimed', $5, 1, NOW(), NOW())
          `, [giftId, customerId, tokenId, mDate, notesStr]);

          insertedCount++;
        }
      }
    }

    // 4. Process CSV 2: "Bissi folder - Shree krishna aasociates gift record.csv"
    const f2 = 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Shree krishna aasociates gift record.csv';
    if (fs.existsSync(f2)) {
      console.log(`Processing file: ${path.basename(f2)}`);
      const lines = fs.readFileSync(f2, 'utf8').split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 1) {
        const headers = parseCSVLine(lines[0]);
        const monthCols = [];
        headers.forEach((h, idx) => {
          if (/\b(jun|jul|aug|sep|oct|nov|dec|jan|feb|mar)/i.test(h) && idx >= 5) {
            monthCols.push({ idx, name: h.trim() });
          }
        });

        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i]);
          if (!row || row.length === 0) continue;

          const rawTok = row[0];
          const rawName = row[1];
          const normTok = normalizeToken(rawTok);
          if (!normTok) continue;

          let tokenInfo = tokenMap.get(normTok);
          let customerId = tokenInfo ? tokenInfo.customerId : null;
          let tokenId = tokenInfo ? tokenInfo.tokenId : null;

          if (!customerId && rawName) {
            customerId = custNameMap.get(normalizeStr(rawName));
          }

          if (!customerId || !tokenId) continue;

          for (const mCol of monthCols) {
            const val = row[mCol.idx];
            if (!val || val.trim().length === 0) continue;
            const cleanVal = val.trim();

            const isCash = cleanVal.toLowerCase().includes('cash') || cleanVal.toLowerCase().includes('money');
            const claimMode = isCash ? 'CASH' : 'GIFT';
            const giftId = await getOrCreateGiftId(cleanVal);
            const notesStr = `Month: ${mCol.name} | Claim Mode = ${claimMode} | Gift: ${cleanVal}`;

            // Check duplicate
            const dup = await client.query('SELECT id FROM gift_distributions WHERE customer_id = $1 AND committee_id = 4 AND notes LIKE $2', [customerId, `%Month: ${mCol.name}%`]);
            if (dup.rows.length === 0) {
              await client.query(`
                INSERT INTO gift_distributions (
                  gift_id, customer_id, committee_id, token_id, quantity, distribution_date, status, notes, branch_id, created_at, updated_at
                ) VALUES ($1, $2, 4, $3, 1, '2026-06-10'::date, 'claimed', $4, 1, NOW(), NOW())
              `, [giftId, customerId, tokenId, notesStr]);
              insertedCount++;
            }
          }
        }
      }
    }

    console.log(`\n🎉 SHREE KRISHNA GIFT RE-IMPORT COMPLETE! Inserted ${insertedCount} clean gift records.`);

    // Verify distinct months in DB for Committee 4
    const resVer = await client.query(`
      SELECT DISTINCT notes, distribution_date
      FROM gift_distributions
      WHERE committee_id = 4
      ORDER BY distribution_date ASC
    `);
    console.log('\nUpdated Shree Krishna Months in DB:');
    console.table(resVer.rows);

  } catch (err) {
    console.error('Error re-importing Shree Krishna gifts:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
