import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
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

async function run() {
  console.log('=====================================================');
  console.log('FAST BATCH IMPORTING ALL GIFTS & CASH FOR 4 BISSI SCHEMES');
  console.log('=====================================================');

  const client = await pool.connect();

  try {
    // 1. Existing Gifts Inventory Map
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

    // 2. Existing tokens map: "commId_tokenNo" -> { tokenId, customerId }
    const tokensRes = await client.query('SELECT id, committee_id, customer_id, token_number FROM tokens');
    const tokenMap = new Map();
    for (const t of tokensRes.rows) {
      const normTok = normalizeToken(t.token_number);
      tokenMap.set(`${t.committee_id}_${normTok}`, { tokenId: t.id, customerId: t.customer_id });
    }

    // 3. Existing customers map: normName -> customerId
    const custsRes = await client.query('SELECT id, name FROM customers');
    const custNameMap = new Map();
    for (const c of custsRes.rows) custNameMap.set(normalizeStr(c.name), c.id);

    // 4. Existing gift_distributions set to avoid duplicates: "commId_cust_month"
    const gdRes = await client.query('SELECT committee_id, customer_id, notes FROM gift_distributions');
    const existingGDSet = new Set();
    for (const r of gdRes.rows) {
      const mMatch = (r.notes || '').match(/Month:\s*([^|]+)/i);
      if (mMatch) {
        const monthStr = normalizeStr(mMatch[1]);
        existingGDSet.add(`${r.committee_id}_${r.customer_id}_${monthStr}`);
      }
    }

    const csvFiles = [
      { path: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Sawariya seth bissi gift record.csv', commId: 1 },
      { path: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Sawariya seth bissi gift record (1).csv', commId: 1 },
      { path: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Pyare mohan bissi gift records.csv', commId: 2 },
      { path: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Pyare Mohan bissi gift sheets.csv', commId: 2 },
      { path: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Hare ka sahara bissi gift records.csv', commId: 3 },
      { path: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Shree krishna aasociates gift record.csv', commId: 4 },
      { path: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Shree krishna gift sheet.csv', commId: 4 },
    ];

    const recordsToInsert = [];

    for (const item of csvFiles) {
      if (!fs.existsSync(item.path)) continue;
      console.log(`Reading CSV: ${path.basename(item.path)} (Comm ID: ${item.commId})`);

      const content = fs.readFileSync(item.path, 'utf8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      if (lines.length === 0) continue;

      const headers = parseCSVLine(lines[0]);
      const monthCols = [];
      headers.forEach((h, idx) => {
        if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(h)) {
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

        let tokenInfo = tokenMap.get(`${item.commId}_${normTok}`);
        let customerId = tokenInfo ? tokenInfo.customerId : null;
        let tokenId = tokenInfo ? tokenInfo.tokenId : null;

        if (!customerId && rawName) {
          customerId = custNameMap.get(normalizeStr(rawName));
        }

        if (!customerId && rawName && rawName.trim().length > 2 && !['Name', 'Token', 'Mobile', '-'].includes(rawName.trim())) {
          const cleanN = rawName.trim();
          const insCust = await client.query(`
            INSERT INTO customers (name, mobile, reference_number, branch_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, 1, 'active', NOW(), NOW())
            RETURNING id
          `, [cleanN, `9000${Math.floor(100000 + Math.random() * 900000)}`, `REF-GIFT-${Math.floor(1000 + Math.random() * 9000)}`]);
          customerId = insCust.rows[0].id;
          custNameMap.set(normalizeStr(cleanN), customerId);
        }

        if (!customerId) continue;

        if (!tokenId) {
          const insTok = await client.query(`
            INSERT INTO tokens (committee_id, customer_id, token_number, status, created_at)
            VALUES ($1, $2, $3, 'active', NOW())
            RETURNING id
          `, [item.commId, customerId, normTok]);
          if (insTok.rows.length > 0) {
            tokenId = insTok.rows[0].id;
            tokenMap.set(`${item.commId}_${normTok}`, { tokenId, customerId });
          } else {
            const getT = await client.query('SELECT id FROM tokens WHERE committee_id = $1 AND customer_id = $2 LIMIT 1', [item.commId, customerId]);
            if (getT.rows.length > 0) tokenId = getT.rows[0].id;
          }
        }

        if (!tokenId) continue;

        for (const mCol of monthCols) {
          const val = row[mCol.idx];
          if (!val || val.trim().length === 0) continue;

          const cleanVal = val.trim();
          if (['Name', 'Token', 'Mobile', '-', 'JSK'].includes(cleanVal)) continue;

          const monthNorm = normalizeStr(mCol.name);
          const dupKey = `${item.commId}_${customerId}_${monthNorm}`;
          if (existingGDSet.has(dupKey)) continue;

          existingGDSet.add(dupKey);

          const isCash = cleanVal.toLowerCase().includes('cash') || cleanVal.toLowerCase().includes('money');
          const claimMode = isCash ? 'CASH' : 'GIFT';
          const giftId = await getOrCreateGiftId(cleanVal);
          const notesStr = `Month: ${mCol.name} | Claim Mode = ${claimMode} | Gift: ${cleanVal}`;

          recordsToInsert.push({
            giftId,
            customerId,
            committeeId: item.commId,
            tokenId,
            notes: notesStr
          });
        }
      }
    }

    console.log(`Total new gift/cash records to insert: ${recordsToInsert.length}`);

    // Batch insert 100 at a time
    let insertedCount = 0;
    for (let i = 0; i < recordsToInsert.length; i += 100) {
      const batch = recordsToInsert.slice(i, i + 100);
      const values = [];
      const placeholders = batch.map((r, idx) => {
        const bIdx = idx * 5;
        values.push(r.giftId, r.customerId, r.committeeId, r.tokenId, r.notes);
        return `($${bIdx + 1}, $${bIdx + 2}, $${bIdx + 3}, $${bIdx + 4}, 1, CURRENT_DATE, 'claimed', $${bIdx + 5}, 1, NOW(), NOW())`;
      }).join(', ');

      await client.query(`
        INSERT INTO gift_distributions (gift_id, customer_id, committee_id, token_id, quantity, distribution_date, status, notes, branch_id, created_at, updated_at)
        VALUES ${placeholders}
      `, values);

      insertedCount += batch.length;
    }

    console.log(`\n🎉 FAST BATCH GIFT IMPORT FINISHED! Inserted ${insertedCount} new records.`);

    // Final verification counts
    const finalRes = await client.query(`
      SELECT c.id, c.name, COUNT(gd.id) as gift_count
      FROM committees c
      LEFT JOIN gift_distributions gd ON gd.committee_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.id ASC
    `);
    console.table(finalRes.rows);

  } catch (err) {
    console.error('Error during batch gift import:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
