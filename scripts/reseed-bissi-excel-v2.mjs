import pg from 'pg';
import xlsx from 'xlsx';
import path from 'path';

const connectionString = 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new pg.Pool({ connectionString });

const excelPath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx';
const wb = xlsx.readFile(excelPath);

console.log("=== STARTING CLEAN BISSI RE-SEED FROM EXCEL ===");

const parseExcelDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s === '-' || s === '.' || s.toLowerCase() === 'done') return null;
    const parts = s.split(/[\/\-\s.]+/);
    if (parts.length >= 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m, d);
      }
    }
  }
  return null;
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log("Clearing old collections, transactions, installments, lotteries, draw results, tokens...");
    await client.query('DELETE FROM collections');
    await client.query('DELETE FROM financial_transactions');
    await client.query('DELETE FROM ledger');
    await client.query('DELETE FROM cashbook_entries');
    await client.query('DELETE FROM collection_registers');
    await client.query('DELETE FROM installments');
    await client.query('DELETE FROM gift_distributions');
    await client.query('DELETE FROM draw_results');
    await client.query('DELETE FROM draw_events');
    await client.query('DELETE FROM token_status_history');
    await client.query('DELETE FROM token_transfer_history');
    await client.query('DELETE FROM lotteries');
    await client.query('DELETE FROM tokens');
    // Keep existing customers if any, or soft-reconnect
    // We willupsert customers by mobile/name

    // 1. Ensure 4 main Committees exist in DB with proper UUIDs
    const schemesConfig = [
      { id: 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31', aliasId: '4', name: 'Sawariya Seth Bissi (5th Date)', sheetName: 'Sawariya seth 5 date', installment: 3000, drawDate: '5th Date', memberLimit: 500 },
      { id: '33333333-3333-3333-3333-333333333333', aliasId: '3', name: 'Pyare Mohan Bissi (15th Date)', sheetName: 'Pyare mohan 15 date', installment: 3000, drawDate: '15th Date', memberLimit: 500 },
      { id: '11111111-1111-1111-1111-111111111111', aliasId: '1', name: 'Hare Ka Sahara Bissi (20th Date)', sheetName: 'Hare ka sahara bissi 20 date', installment: 2500, drawDate: '20th Date', memberLimit: 500 },
      { id: '22222222-2222-2222-2222-222222222222', aliasId: '2', name: 'Shree Krishna Associates Bissi (20th Date)', sheetName: 'Shree Krishna associate lottery', installment: 3000, drawDate: '20th Date', memberLimit: 1111 }
    ];

    for (const sc of schemesConfig) {
      await client.query(`
        INSERT INTO committees (id, organization_id, code, name, monthly_installment, total_members, total_months, start_date, status, created_at, updated_at)
        VALUES ($1, '00000000-0000-0000-0000-000000000001', $2, $3, $4, $5, 20, '2023-06-01', 'ACTIVE', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET 
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          monthly_installment = EXCLUDED.monthly_installment,
          total_members = EXCLUDED.total_members,
          total_months = 20,
          start_date = '2023-06-01',
          status = 'ACTIVE'
      `, [sc.id, `BISSI-${sc.aliasId}`, sc.name, sc.installment, sc.memberLimit]);
    }

    console.log("✅ 4 Schemes configured in database.");

    // Helper to find or create customer
    const customerMap = new Map(); // key -> { id: UUID, intId: integer }
    let nextCustomerIntId = 1;

    const getOrCreateCustomer = async (nameRaw, phoneRaw, refNameRaw, addressRaw) => {
      const name = (nameRaw || "Bissi Member").toString().trim();
      const phoneClean = (phoneRaw || "").toString().replace(/[^0-9]/g, '');
      const key = phoneClean.length >= 10 ? phoneClean.slice(-10) : name.toLowerCase();

      if (customerMap.has(key)) {
        return customerMap.get(key);
      }

      const phoneVal = phoneClean.length >= 10 ? phoneClean.slice(-10) : `999${Math.floor(1000000 + Math.random()*9000000)}`;

      const res = await client.query(`
        SELECT id FROM customers WHERE mobile = $1 OR name ILIKE $2 LIMIT 1
      `, [phoneVal, name]);

      let custId;
      if (res.rows.length > 0) {
        custId = res.rows[0].id;
      } else {
        const ins = await client.query(`
          INSERT INTO customers (organization_id, name, mobile, address, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING id
        `, ['00000000-0000-0000-0000-000000000001', name, phoneVal, addressRaw || null]);
        custId = ins.rows[0].id;
      }

      const custObj = { id: custId, intId: nextCustomerIntId++ };
      customerMap.set(key, custObj);
      return custObj;
    };

    // 2. Parse Lucky Tokens Sheet
    const luckySheetName = wb.SheetNames.find(s => s.trim().toLowerCase() === 'lucky token list');
    const luckyWinnersMap = new Map(); // schemeKey -> Map(tokenNoStr -> monthStr)

    if (luckySheetName) {
      const sheet = wb.Sheets[luckySheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      // Row 0 has scheme headers, Row 1 has Month/Token No headers
      console.log("Parsing Lucky Token list...");
      for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        // Col 0: Seth vc Month, Col 1: Token no
        // Col 3: Shri krishna Month, Col 4: Token no
        // Col 6: Pyare Mohan Month, Col 7: Token no
        // Col 9: Hare ka Month, Col 10: Token no
        const parseLuckyPair = (schemeId, mVal, tVal) => {
          if (mVal && tVal !== undefined && tVal !== null) {
            const tStr = String(tVal).trim();
            const mStr = String(mVal).trim();
            if (tStr && mStr) {
              if (!luckyWinnersMap.has(schemeId)) luckyWinnersMap.set(schemeId, new Map());
              luckyWinnersMap.get(schemeId).set(tStr, mStr);
            }
          }
        };

        parseLuckyPair('a3d68b9c-63df-4884-a5ad-eb8a17e3be31', r[0], r[1]);
        parseLuckyPair('22222222-2222-2222-2222-222222222222', r[3], r[4]);
        parseLuckyPair('33333333-3333-3333-3333-333333333333', r[6], r[7]);
        parseLuckyPair('11111111-1111-1111-1111-111111111111', r[9], r[10]);
      }
    }

    console.log(`✅ Loaded Lucky Draw winners across schemes.`);

    // 3. Process each Scheme Main Sheet (Sawariya, Pyare, Hare, Shree Krishna)
    for (const sc of schemesConfig) {
      const actualSheetName = wb.SheetNames.find(s => s.trim().toLowerCase() === sc.sheetName.trim().toLowerCase());
      if (!actualSheetName) {
        console.log(`⚠️ Sheet missing for ${sc.name}`);
        continue;
      }

      console.log(`Importing scheme: ${sc.name} from sheet "${actualSheetName}"...`);
      const sheet = wb.Sheets[actualSheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const headers = rows[0] || [];

      // Extract month dates from column headers starting from col Index 6 or 7
      const colMonthDates = [];
      for (let c = 5; c < headers.length; c++) {
        const hVal = headers[c];
        if (hVal !== undefined && hVal !== null) {
          const parsedD = parseExcelDate(hVal);
          if (parsedD) {
            colMonthDates[c] = parsedD;
          }
        }
      }

      const seenTokensInScheme = new Map();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row[0] === undefined || row[0] === null || String(row[0]).trim() === '') continue;

        let rawTokStr = String(row[0]).trim();
        let name = row[1];
        let refName = row[2];
        let phone = row[3] || row[4];
        let address = row[5];

        if (!name && !phone) continue;

        // Custom token label overrides per user directive:
        if (sc.id === 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31' && rawTokStr === '443') {
          const count = (seenTokensInScheme.get('443') || 0) + 1;
          seenTokensInScheme.set('443', count);
          rawTokStr = count === 1 ? '443A' : '443B';
        } else if (sc.id === '22222222-2222-2222-2222-222222222222' && rawTokStr === '3') {
          const count = (seenTokensInScheme.get('3') || 0) + 1;
          seenTokensInScheme.set('3', count);
          rawTokStr = count === 1 ? '3A' : '3B';
        }

        const custObj = await getOrCreateCustomer(name, phone, refName, address);

        // Check if token is lucky
        const luckyMapForScheme = luckyWinnersMap.get(sc.id);
        const isLucky = luckyMapForScheme ? (luckyMapForScheme.has(rawTokStr) || luckyMapForScheme.has(String(parseInt(rawTokStr, 10)))) : false;
        const status = isLucky ? 'LUCKY_OUT' : 'ACTIVE';

        // Insert Token
        const tokIns = await client.query(`
          INSERT INTO tokens (committee_id, customer_id, raw_token_number, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING id
        `, [sc.id, custObj.id, rawTokStr, status]);

        const tokId = tokIns.rows[0].id;

        if (isLucky) {
          const luckyMonthStr = luckyMapForScheme.get(rawTokStr) || luckyMapForScheme.get(String(parseInt(rawTokStr, 10))) || "Mar 2025";
          await client.query(`
            INSERT INTO lotteries (committee_id, winner_id, draw_date, status, notes, created_at)
            VALUES ($1, $2, NOW(), 'completed', $3, NOW())
            ON CONFLICT DO NOTHING
          `, [sc.id, custObj.id, `Lucky Winner (${luckyMonthStr}) Token ${rawTokStr}`]);
        }

        // Process Month Collections
        for (let c = 5; c < row.length; c++) {
          const amtVal = row[c];
          if (amtVal !== undefined && amtVal !== null) {
            const amtNum = typeof amtVal === 'number' ? amtVal : parseFloat(String(amtVal).replace(/[^0-9.]/g, ''));
            if (!isNaN(amtNum) && amtNum > 0) {
              const colDate = colMonthDates[c] || new Date(2025, 2, 15); // Fallback March 2025
              await client.query(`
                INSERT INTO collections (committee_id, customer_id, amount, payment_mode, verification_status, collected_at, notes, created_at)
                VALUES ($1, $2, $3, 'cash', 'verified', $4, $5, NOW())
              `, [parseInt(sc.aliasId, 10), custObj.intId, amtNum, colDate, `Token ${rawTokStr}`]);
            }
          }
        }
      }
      console.log(`✅ Finished importing scheme ${sc.name}`);
    }

    // 4. Import Daily Diary sheet
    const diarySheetName = wb.SheetNames.find(s => s.trim().toLowerCase() === 'daily diary');
    if (diarySheetName) {
      console.log("Importing daily diary notes...");
      const sheet = wb.Sheets[diarySheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        const name = String(r[0]).trim();
        const phone = r[1];
        const reason = r[4] || r[3] || "Diary Entry";
        const address = r[5];
        if (name) {
          await client.query(`
            INSERT INTO office_diary (title, content, category, created_at, updated_at)
            VALUES ($1, $2, 'DAILY_DIARY', NOW(), NOW())
          `, [`Diary: ${name} (${phone || ''})`, `Address: ${address || ''} | Notes: ${reason}`]);
        }
      }
      console.log("✅ Daily diary imported.");
    }

    await client.query('COMMIT');
    console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ SEED ERROR:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
