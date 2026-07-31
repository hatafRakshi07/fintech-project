import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  max: 1
});

const GIFT_FOLDER = "C:\\Users\\iSN_kota_T52\\Downloads\\gift sheet";
const MONTH_MAP = { jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,june:6,jun:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12 };

function parseHeaderDate(col) {
  if (!col) return null;
  const s = String(col).trim().toLowerCase();
  const m1 = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2,'0')}-${m1[3].padStart(2,'0')}`;
  const parts = s.split(/[\s\-_]+/);
  let mNum = null, year = null;
  for (const p of parts) {
    if (MONTH_MAP[p]) mNum = MONTH_MAP[p];
    else if (/^\d{2,4}$/.test(p)) { const y = parseInt(p); year = y < 100 ? 2000+y : y; }
  }
  if (mNum && year) return `${year}-${String(mNum).padStart(2,'0')}-25`;
  return null;
}

function parseCSV(content) {
  return content.split(/\r?\n/).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Building lottery inserts from CSV files...");

    await client.query("BEGIN");
    await client.query("TRUNCATE TABLE lotteries RESTART IDENTITY");

    // Get all customers in one go
    const custRes = await client.query("SELECT id, name, mobile FROM customers");
    const mobMap = {}, nameMap = {};
    custRes.rows.forEach(r => {
      if (r.mobile) mobMap[r.mobile] = r.id;
      if (r.name) nameMap[r.name.toLowerCase().trim()] = r.id;
    });

    const filesConfig = [
      { name: "Bissi folder - Sawariya seth bissi gift record.csv", commId: 1, maxToken: 500 },
      { name: "Bissi folder - Pyare mohan bissi gift records.csv", commId: 2, maxToken: 500 },
      { name: "Bissi folder - Pyare Mohan bissi gift sheets.csv", commId: 2, maxToken: 500 },
      { name: "Bissi folder - Hare ka sahara bissi gift records.csv", commId: 3, maxToken: 500 },
      { name: "Bissi folder - Hare ka sahara bissi gift sheets.csv", commId: 3, maxToken: 500 },
      { name: "Bissi folder - Shree krishna gift sheet.csv", commId: 4, maxToken: 1111 },
      { name: "Bissi folder - Shree krishna aasociates gift record.csv", commId: 4, maxToken: 1111 },
      { name: "Bissi folder - Shree Krishna associate lottery.csv", commId: 4, maxToken: 1111 }
    ];

    // Build VALUES rows in memory first
    const allValues = [];
    
    for (const cfg of filesConfig) {
      const fpath = path.join(GIFT_FOLDER, cfg.name);
      if (!fs.existsSync(fpath)) continue;

      const rows = parseCSV(fs.readFileSync(fpath, 'utf8'));
      if (rows.length <= 1) continue;

      const header1 = rows[0];
      const dateCols = [];
      header1.forEach((col, idx) => {
        const dt = parseHeaderDate(col);
        if (dt) dateCols.push({ colIdx: idx, drawDate: dt });
      });

      for (let rIdx = 1; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        if (!row || row.length < 2) continue;

        let tokenNum = null;
        for (let i = 0; i < Math.min(4, row.length); i++) {
          const s = (row[i] || '').split('.')[0].trim();
          if (/^\d+$/.test(s)) {
            const val = parseInt(s, 10);
            if (val >= 1 && val <= cfg.maxToken) { tokenNum = val; break; }
          }
        }
        if (!tokenNum) continue;

        const cName = (row[1] || '').trim();
        const mob = (row[3] || '').trim().replace(/\.0$/, '');
        let custId = (mob && mobMap[mob]) || (cName && nameMap[cName.toLowerCase()]) || null;
        if (!custId) { custId = custRes.rows[0]?.id || 1; }

        for (const dc of dateCols) {
          if (dc.colIdx < row.length) {
            const giftVal = (row[dc.colIdx] || '').trim();
            if (giftVal && !['none', '', '-', '0', 'done'].includes(giftVal.toLowerCase())) {
              const rewardType = giftVal.toLowerCase().includes('cash') ? 'cash' : 'gift';
              allValues.push(`(${cfg.commId}, ${custId}, '${dc.drawDate}', '${giftVal.replace(/'/g,"''")}', 'completed', '${rewardType}', '${dc.drawDate}')`);
            }
          }
        }
      }
      console.log(`  Processed ${cfg.name} -> ${allValues.length} records so far`);
    }

    // Bulk insert all at once
    if (allValues.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < allValues.length; i += chunkSize) {
        const chunk = allValues.slice(i, i + chunkSize);
        await client.query(`
          INSERT INTO lotteries (committee_id, winner_id, draw_date, notes, status, reward_type, created_at)
          VALUES ${chunk.join(',')}
        `);
      }
    }

    await client.query("COMMIT");
    console.log(`\nSUCCESS! Inserted ${allValues.length} lottery/gift winners records in bulk!`);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
