import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

const GIFT_FOLDER = "C:\\Users\\iSN_kota_T52\\Downloads\\gift sheet";

const MONTH_MAP = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, june: 6, jun: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12
};

function parseHeaderDate(colName) {
  if (!colName) return null;
  const s = String(colName).trim().toLowerCase();
  
  const mYmd = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mYmd) {
    return `${mYmd[1]}-${String(mYmd[2]).padStart(2, '0')}-${String(mYmd[3]).padStart(2, '0')}`;
  }

  const parts = s.split(/[\s\-_]+/);
  let mNum = null, year = null;
  for (const p of parts) {
    if (MONTH_MAP[p]) mNum = MONTH_MAP[p];
    else if (/^\d+$/.test(p)) {
      const yVal = parseInt(p, 10);
      year = yVal < 100 ? 2000 + yVal : yVal;
    }
  }

  if (mNum && year) {
    return `${year}-${String(mNum).padStart(2, '0')}-25`;
  }
  return null;
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/);
  return lines.map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
}

async function main() {
  try {
    console.log("=== POPULATING ALL LOTTERIES & GIFTS FROM GIFT SHEET FOLDER ===");

    // Fetch existing customers map
    const custRes = await pool.query("SELECT id, name, mobile FROM customers");
    const custMap = new Map();
    custRes.rows.forEach(r => {
      if (r.mobile) custMap.set(r.mobile, r.id);
      if (r.name) custMap.set(r.name.toLowerCase().trim(), r.id);
    });

    // Helper to get customer ID
    async function getCustId(name, mobile) {
      if (mobile && custMap.has(mobile)) return custMap.get(mobile);
      const cleanName = (name || "").toLowerCase().trim();
      if (cleanName && custMap.has(cleanName)) return custMap.get(cleanName);

      const finalName = name || "Member";
      const finalMob = mobile || `9000${Math.floor(100000 + Math.random() * 900000)}`;
      const ins = await pool.query(`
        INSERT INTO customers (name, mobile, reference_number, branch_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, 1, 'active', NOW(), NOW())
        RETURNING id
      `, [finalName, finalMob, `REF-${Math.floor(1000 + Math.random() * 9000)}`]);
      
      const cid = ins.rows[0].id;
      if (mobile) custMap.set(mobile, cid);
      if (cleanName) custMap.set(cleanName, cid);
      return cid;
    }

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

    // Clear existing lotteries table
    await pool.query("TRUNCATE TABLE lotteries RESTART IDENTITY");

    let totalLotteries = 0;

    for (const cfg of filesConfig) {
      const fpath = path.join(GIFT_FOLDER, cfg.name);
      if (!fs.existsSync(fpath)) continue;

      console.log(`Processing file: ${cfg.name}...`);
      const content = fs.readFileSync(fpath, 'utf8');
      const rows = parseCSV(content);
      if (rows.length <= 1) continue;

      const header1 = rows[0];

      // Identify date columns
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
            if (val >= 1 && val <= cfg.maxToken) {
              tokenNum = val;
              break;
            }
          }
        }
        if (!tokenNum) continue;

        const cName = row[1] || null;
        const mob = row[3] || null;
        const custId = await getCustId(cName || `Token #${tokenNum}`, mob);

        // Ensure token exists
        await pool.query(`
          INSERT INTO tokens (token_number, committee_id, customer_id, status, created_at)
          VALUES ($1, $2, $3, 'active', NOW())
          ON CONFLICT DO NOTHING
        `, [String(tokenNum), cfg.commId, custId]);

        for (const dc of dateCols) {
          if (dc.colIdx < row.length) {
            const giftVal = (row[dc.colIdx] || '').trim();
            if (giftVal && !['none', '', '-', '0', 'done'].includes(giftVal.toLowerCase())) {
              const rewardType = giftVal.toLowerCase().includes('cash') ? 'cash' : 'gift';
              await pool.query(`
                INSERT INTO lotteries (committee_id, winner_id, draw_date, notes, status, reward_type, created_at)
                VALUES ($1, $2, $3, $4, 'completed', $5, $3::timestamp)
              `, [cfg.commId, custId, dc.drawDate, `Winner Reward: ${giftVal}`, rewardType]);
              totalLotteries++;
            }
          }
        }
      }
    }

    console.log(`\nSUCCESSFULLY INSERTED ${totalLotteries} LOTTERIES / GIFT WINNERS!`);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
