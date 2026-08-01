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

function getDistributionDate(monthStr, committeeId) {
  if (!monthStr) return '2026-06-15';
  const drawDayMap = { 1: 5, 2: 15, 3: 20, 4: 10 };
  const drawDay = drawDayMap[committeeId] || 15;

  const m = monthStr.toLowerCase();
  let year = 2026;
  if (/23/.test(m)) year = 2023;
  else if (/24/.test(m)) year = 2024;
  else if (/25/.test(m)) year = 2025;
  else if (/26/.test(m)) year = 2026;
  else if (/27/.test(m)) year = 2027;

  let monthNum = 6;
  if (m.includes('jan')) monthNum = 1;
  else if (m.includes('feb')) monthNum = 2;
  else if (m.includes('mar')) monthNum = 3;
  else if (m.includes('apr')) monthNum = 4;
  else if (m.includes('may')) monthNum = 5;
  else if (m.includes('jun')) monthNum = 6;
  else if (m.includes('jul')) monthNum = 7;
  else if (m.includes('aug')) monthNum = 8;
  else if (m.includes('sep')) monthNum = 9;
  else if (m.includes('oct')) monthNum = 10;
  else if (m.includes('nov')) monthNum = 11;
  else if (m.includes('dec')) monthNum = 12;

  const mm = String(monthNum).padStart(2, '0');
  const dd = String(drawDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

async function main() {
  console.log('=====================================================');
  console.log('FAST BULK ALL-YEAR GIFT IMPORT (2024 to 2026)');
  console.log('=====================================================');

  const client = await pool.connect();

  try {
    await client.query('DELETE FROM gift_distributions');
    console.log('Cleared gift_distributions table for complete clean re-import.');

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

    const dl = 'C:\\Users\\lenovo\\Downloads';
    let totalImported = 0;

    const committeeConfigs = [
      {
        id: 1,
        name: 'Sawariya Seth Bissi (5th Date)',
        drawDay: 5,
        sheetFiles: [
          path.join(dl, 'Bissi folder - Sawariya bissi 5 date gift sheets.csv'),
          path.join(dl, 'Bissi folder - Sawariya seth bissi gift record.csv'),
          path.join(dl, 'Bissi folder - Sawariya seth bissi gift record (1).csv')
        ]
      },
      {
        id: 2,
        name: 'Pyare Mohan Bissi (15th Date)',
        drawDay: 15,
        sheetFiles: [
          path.join(dl, 'Bissi folder - Pyare Mohan bissi gift sheets.csv'),
          path.join(dl, 'Bissi folder - Pyare Mohan bissi gift sheets (1).csv'),
          path.join(dl, 'Bissi folder - Pyare mohan bissi gift records.csv'),
          path.join(dl, 'Bissi folder - Pyare mohan bissi gift records (1).csv')
        ]
      },
      {
        id: 3,
        name: 'Hare Ka Sahara Bissi (20th Date)',
        drawDay: 20,
        sheetFiles: [
          path.join(dl, 'Bissi folder - Hare ka sahara bissi gift records.csv'),
          path.join(dl, 'Bissi folder - Hare ka sahara bissi 20 date.csv')
        ]
      },
      {
        id: 4,
        name: 'Shree Krishna Associate Bissi (10th Date)',
        drawDay: 10,
        sheetFiles: [
          path.join(dl, 'Bissi folder - Shree krishna gift sheet.csv'),
          path.join(dl, 'Bissi folder - Shree krishna aasociates gift record.csv')
        ]
      }
    ];

    for (const conf of committeeConfigs) {
      console.log(`\nProcessing Gifts for ${conf.name}...`);

      const tokensRes = await client.query('SELECT id, customer_id, token_number FROM tokens WHERE committee_id = $1', [conf.id]);
      const tokenMap = new Map();
      for (const t of tokensRes.rows) {
        tokenMap.set(normalizeToken(t.token_number), { tokenId: t.id, customerId: t.customer_id });
      }

      const pendingInserts = [];
      const seenSet = new Set();

      for (const fPath of conf.sheetFiles) {
        if (!fs.existsSync(fPath)) continue;

        const lines = fs.readFileSync(fPath, 'utf8').split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) continue;

        const row0 = parseCSVLine(lines[0]);
        const row1 = parseCSVLine(lines[1]);

        const monthBlocks = [];
        for (let i = 0; i < row1.length; i++) {
          const colName = row1[i]?.toLowerCase() || '';
          if (colName.includes('token')) {
            let mName = row0[i - 1] || row0[i] || row0[i + 1] || '';
            if (!mName) {
              for (let k = i; k >= 0; k--) {
                if (row0[k]) { mName = row0[k]; break; }
              }
            }
            if (mName.trim().length > 0) {
              monthBlocks.push({ nameCol: i - 1, tokCol: i, statusCol: i + 1, monthName: mName.trim() });
            }
          }
        }

        if (monthBlocks.length > 0) {
          for (let rIdx = 2; rIdx < lines.length; rIdx++) {
            const row = parseCSVLine(lines[rIdx]);
            if (!row || row.length === 0) continue;

            for (const block of monthBlocks) {
              const rawName = row[block.nameCol];
              const rawTok = row[block.tokCol];
              const rawStatus = row[block.statusCol];

              if (!rawStatus || rawStatus.trim().length === 0) continue;
              const cleanStatus = rawStatus.trim();
              if (['Name', 'Token', 'Token no', 'Gift status', 'Gift Status', '-', '0'].includes(cleanStatus)) continue;

              const normTok = normalizeToken(rawTok);
              let tokenInfo = normTok ? tokenMap.get(normTok) : null;
              let customerId = tokenInfo ? tokenInfo.customerId : null;
              let tokenId = tokenInfo ? tokenInfo.tokenId : null;

              if (!customerId && rawName) customerId = custNameMap.get(normalizeStr(rawName));
              if (!customerId) continue;

              if (!tokenId && normTok) {
                const insTok = await client.query(`
                  INSERT INTO tokens (committee_id, customer_id, token_number, status, created_at)
                  VALUES ($1, $2, $3, 'active', NOW())
                  RETURNING id
                `, [conf.id, customerId, normTok]);
                tokenId = insTok.rows[0].id;
                tokenMap.set(normTok, { tokenId, customerId });
              }

              if (!tokenId) continue;

              const distDate = getDistributionDate(block.monthName, conf.id);
              const isCash = cleanStatus.toLowerCase().includes('cash') || cleanStatus.toLowerCase().includes('money');
              const claimMode = isCash ? 'CASH' : 'GIFT';
              const giftId = await getOrCreateGiftId(cleanStatus);
              const notesStr = `Month: ${block.monthName} | Claim Mode = ${claimMode} | Gift: ${cleanStatus}`;

              const key = `${tokenId}_${notesStr}`;
              if (seenSet.has(key)) continue;
              seenSet.add(key);

              pendingInserts.push({ giftId, customerId, committeeId: conf.id, tokenId, distDate, notes: notesStr });
            }
          }
        } else {
          const monthCols = [];
          row0.forEach((h, idx) => {
            if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(h) && idx >= 4) {
              monthCols.push({ idx, monthName: h.trim() });
            }
          });

          for (let rIdx = 1; rIdx < lines.length; rIdx++) {
            const row = parseCSVLine(lines[rIdx]);
            if (!row || row.length === 0) continue;

            const rawTok = row[0];
            const rawName = row[1];
            const normTok = normalizeToken(rawTok);
            if (!normTok) continue;

            let tokenInfo = tokenMap.get(normTok);
            let customerId = tokenInfo ? tokenInfo.customerId : null;
            let tokenId = tokenInfo ? tokenInfo.tokenId : null;

            if (!customerId && rawName) customerId = custNameMap.get(normalizeStr(rawName));
            if (!customerId || !tokenId) continue;

            for (const mCol of monthCols) {
              const val = row[mCol.idx];
              if (!val || val.trim().length === 0) continue;
              const cleanVal = val.trim();
              if (['-', '0', '3000', '2500', '3000.0'].includes(cleanVal)) continue;

              const distDate = getDistributionDate(mCol.monthName, conf.id);
              const isCash = cleanVal.toLowerCase().includes('cash') || cleanVal.toLowerCase().includes('money');
              const claimMode = isCash ? 'CASH' : 'GIFT';
              const giftId = await getOrCreateGiftId(cleanVal);
              const notesStr = `Month: ${mCol.monthName} | Claim Mode = ${claimMode} | Gift: ${cleanVal}`;

              const key = `${tokenId}_${notesStr}`;
              if (seenSet.has(key)) continue;
              seenSet.add(key);

              pendingInserts.push({ giftId, customerId, committeeId: conf.id, tokenId, distDate, notes: notesStr });
            }
          }
        }
      }

      // Bulk insert pendingInserts in chunks of 500
      for (let i = 0; i < pendingInserts.length; i += 500) {
        const chunk = pendingInserts.slice(i, i + 500);
        const valueStrings = [];
        const params = [];

        chunk.forEach((item, idx) => {
          const offset = idx * 6;
          valueStrings.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 1, $${offset + 5}::date, 'claimed', $${offset + 6}, 1, NOW(), NOW())`);
          params.push(item.giftId, item.customerId, item.committeeId, item.tokenId, item.distDate, item.notes);
        });

        const query = `
          INSERT INTO gift_distributions (gift_id, customer_id, committee_id, token_id, quantity, distribution_date, status, notes, branch_id, created_at, updated_at)
          VALUES ${valueStrings.join(', ')}
        `;
        await client.query(query, params);
      }

      console.log(`✅ Bulk inserted ${pendingInserts.length} gift distribution rows for ${conf.name}.`);
      totalImported += pendingInserts.length;
    }

    console.log(`\n🎉 TOTAL GIFT DISTRIBUTIONS IMPORTED: ${totalImported}`);

    const summaryRes = await client.query(`
      SELECT committee_id, COUNT(*)::int as count
      FROM gift_distributions
      GROUP BY committee_id
      ORDER BY committee_id ASC
    `);
    console.log('\nFinal Gift Distributions Count by Committee:');
    console.table(summaryRes.rows);

  } catch (err) {
    console.error('Error executing complete gift import:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
