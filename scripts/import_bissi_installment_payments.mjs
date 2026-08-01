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

function getDrawDate(monthStr, drawDay) {
  if (!monthStr) return null;
  const m = monthStr.toLowerCase();
  
  let year = 2026;
  if (/23/.test(m)) year = 2023;
  else if (/24/.test(m)) year = 2024;
  else if (/25/.test(m)) year = 2025;
  else if (/26/.test(m)) year = 2026;
  else if (/27/.test(m)) year = 2027;

  let monthNum = 1;
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
  console.log('FAST BULK IMPORT: BISSI MONTHLY INSTALLMENT PAYMENTS');
  console.log('=====================================================');

  const client = await pool.connect();

  try {
    // 1. Clear old "Daily Collection by Aryan Sir" records from collections table
    const delRes = await client.query("DELETE FROM collections WHERE notes ILIKE '%Daily Collection by Aryan Sir%'");
    console.log(`Cleared ${delRes.rowCount} Daily Collection by Aryan Sir rows.`);

    // Also delete any existing imported Bissi installment collection rows to allow clean re-import
    const delBissiRes = await client.query("DELETE FROM collections WHERE notes ILIKE '%Bissi Monthly Installment%'");
    console.log(`Cleared ${delBissiRes.rowCount} previous Bissi Monthly Installment rows.`);

    const custsRes = await client.query('SELECT id, name FROM customers');
    const custNameMap = new Map();
    for (const c of custsRes.rows) custNameMap.set(normalizeStr(c.name), c.id);

    const bFiles = [
      {
        file: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Sawariya seth 5 date.csv',
        committeeId: 1,
        drawDay: 5,
        defaultAmount: 3000,
        name: 'Sawariya Seth Bissi'
      },
      {
        file: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Pyare mohan 15 date.csv',
        committeeId: 2,
        drawDay: 15,
        defaultAmount: 3000,
        name: 'Pyare Mohan Bissi'
      },
      {
        file: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Hare ka sahara bissi 20 date.csv',
        committeeId: 3,
        drawDay: 20,
        defaultAmount: 2500,
        name: 'Hare Ka Sahara Bissi'
      },
      {
        file: 'C:\\Users\\lenovo\\Downloads\\Bissi folder - Shree Krishna associate lottery.csv',
        committeeId: 4,
        drawDay: 10,
        defaultAmount: 3000,
        name: 'Shree Krishna Associate Bissi'
      }
    ];

    let totalInserted = 0;

    for (const conf of bFiles) {
      if (!fs.existsSync(conf.file)) continue;

      console.log(`\nProcessing ${conf.name}...`);

      const tokensRes = await client.query('SELECT id, customer_id, token_number FROM tokens WHERE committee_id = $1', [conf.committeeId]);
      const tokenMap = new Map();
      for (const t of tokensRes.rows) {
        tokenMap.set(normalizeToken(t.token_number), { tokenId: t.id, customerId: t.customer_id });
      }

      const lines = fs.readFileSync(conf.file, 'utf8').split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) continue;

      const headers = parseCSVLine(lines[0]);
      
      const monthCols = [];
      headers.forEach((h, idx) => {
        const cleanH = h.trim();
        if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(cleanH) && !cleanH.toLowerCase().includes('name') && !cleanH.toLowerCase().includes('reason')) {
          monthCols.push({ idx, monthName: cleanH });
        }
      });

      const batchValues = [];

      for (let rIdx = 1; rIdx < lines.length; rIdx++) {
        const row = parseCSVLine(lines[rIdx]);
        if (!row || row.length === 0) continue;

        const rawTok = row[0];
        const rawName = row[1];

        const normTok = normalizeToken(rawTok);
        let tokenInfo = normTok ? tokenMap.get(normTok) : null;
        let customerId = tokenInfo ? tokenInfo.customerId : null;

        if (!customerId && rawName) {
          customerId = custNameMap.get(normalizeStr(rawName));
        }

        if (!customerId) continue;

        for (const mCol of monthCols) {
          const val = row[mCol.idx];
          if (!val || val.trim().length === 0) continue;
          const cleanVal = val.trim();
          if (cleanVal === '-' || cleanVal === '0') continue;

          let amount = conf.defaultAmount;
          const numMatch = cleanVal.match(/\d+/);
          if (numMatch) {
            const parsed = parseInt(numMatch[0], 10);
            if (parsed >= 500) amount = parsed;
          }

          const drawDate = getDrawDate(mCol.monthName, conf.drawDay) || '2026-06-15';
          const notesStr = `Month: ${mCol.monthName} | Bissi Monthly Installment Payment (${cleanVal})`;

          batchValues.push({
            customerId,
            committeeId: conf.committeeId,
            amount,
            notes: notesStr,
            collectedAt: drawDate
          });
        }
      }

      // Batch insert in chunks of 500
      for (let i = 0; i < batchValues.length; i += 500) {
        const chunk = batchValues.slice(i, i + 500);
        const valueStrings = [];
        const params = [];

        chunk.forEach((item, idx) => {
          const offset = idx * 5;
          valueStrings.push(`($${offset + 1}, 1, $${offset + 2}, $${offset + 3}, 'cash', $${offset + 4}, $${offset + 5}::timestamp, NOW(), 'verified')`);
          params.push(item.customerId, item.committeeId, item.amount, item.notes, item.collectedAt);
        });

        const query = `
          INSERT INTO collections (customer_id, branch_id, committee_id, amount, payment_mode, notes, collected_at, created_at, verification_status)
          VALUES ${valueStrings.join(', ')}
        `;
        await client.query(query, params);
      }

      console.log(`✅ Bulk inserted ${batchValues.length} installment payment rows for ${conf.name}.`);
      totalInserted += batchValues.length;
    }

    console.log(`\n🎉 TOTAL BISSI INSTALLMENT PAYMENTS IMPORTED: ${totalInserted}`);

  } catch (err) {
    console.error('Error importing Bissi installment payments:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
