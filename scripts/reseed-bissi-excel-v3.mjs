import pg from 'pg';
import xlsx from 'xlsx';
import { randomUUID } from 'crypto';

const connectionString = 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new pg.Pool({ connectionString });

const excelPath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx';
const wb = xlsx.readFile(excelPath);

console.log("=== STARTING CLEAN BISSI RE-SEED v3 (BATCH MODE) ===");

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const parseExcelDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000));
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s === '-' || s === '.' || s.toLowerCase() === 'done') return null;
    const parts = s.split(/[\/\-\s.]+/);
    if (parts.length >= 3) {
      let d = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
    }
  }
  return null;
};

// ── Scheme config with per-sheet column mapping ──
// Columns: tokenCol=0 always
// nameCol, refCol, phoneCol, addressCol differ per sheet
// amtStartCol = first column index where monthly amounts begin
const schemesConfig = [
  { id: 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31', aliasId: '4', name: 'Sawariya Seth Bissi (5th Date)', sheetName: 'Sawariya seth 5 date', installment: 3000, memberLimit: 500,
    nameCol: 1, refCol: 2, phoneCol: 3, addressCol: 5, amtStartCol: 7 },
  { id: '33333333-3333-3333-3333-333333333333', aliasId: '3', name: 'Pyare Mohan Bissi (15th Date)', sheetName: 'Pyare mohan 15 date', installment: 3000, memberLimit: 500,
    nameCol: 1, refCol: 2, phoneCol: 5, addressCol: 7, amtStartCol: 9 },
  { id: '11111111-1111-1111-1111-111111111111', aliasId: '1', name: 'Hare Ka Sahara Bissi (20th Date)', sheetName: 'Hare ka sahara bissi 20 date', installment: 2500, memberLimit: 500,
    nameCol: 1, refCol: 2, phoneCol: 3, addressCol: 4, amtStartCol: 7 },
  { id: '22222222-2222-2222-2222-222222222222', aliasId: '2', name: 'Shree Krishna Associates Bissi (20th Date)', sheetName: 'Shree Krishna associate lottery', installment: 3000, memberLimit: 1111,
    nameCol: 1, refCol: 2, phoneCol: 3, addressCol: null, amtStartCol: 6 }
];

// ── Parse Lucky Token list ──
function parseLuckyTokens() {
  const luckyWinnersMap = new Map();
  const luckySheetName = wb.SheetNames.find(s => s.trim().toLowerCase() === 'lucky token list');
  if (!luckySheetName) return luckyWinnersMap;

  const rows = xlsx.utils.sheet_to_json(wb.Sheets[luckySheetName], { header: 1 });
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const add = (schemeId, mVal, tVal) => {
      if (mVal && tVal !== undefined && tVal !== null) {
        const tStr = String(tVal).trim(), mStr = String(mVal).trim();
        if (tStr && mStr) {
          if (!luckyWinnersMap.has(schemeId)) luckyWinnersMap.set(schemeId, new Map());
          luckyWinnersMap.get(schemeId).set(tStr, mStr);
        }
      }
    };
    add('a3d68b9c-63df-4884-a5ad-eb8a17e3be31', r[0], r[1]);
    add('22222222-2222-2222-2222-222222222222', r[3], r[4]);
    add('33333333-3333-3333-3333-333333333333', r[6], r[7]);
    add('11111111-1111-1111-1111-111111111111', r[9], r[10]);
  }
  return luckyWinnersMap;
}

// ── Batch insert helper ──
async function batchInsert(client, table, columns, rows, batchSize = 200) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const placeholders = [];
    const values = [];
    let paramIdx = 1;
    for (const row of batch) {
      const rowPlaceholders = [];
      for (const val of row) {
        rowPlaceholders.push(`$${paramIdx++}`);
        values.push(val);
      }
      placeholders.push(`(${rowPlaceholders.join(',')})`);
    }
    await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders.join(',')}`,
      values
    );
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Clean ──
    console.log("Clearing old data...");
    const delTables = ['collections', 'financial_transactions', 'ledger', 'cashbook_entries',
      'collection_registers', 'installments', 'gift_distributions', 'draw_results',
      'draw_events', 'token_status_history', 'token_transfer_history', 'lotteries', 'tokens'];
    for (const t of delTables) await client.query(`DELETE FROM ${t}`);

    // ── Committees ──
    for (const sc of schemesConfig) {
      await client.query(`
        INSERT INTO committees (id, organization_id, code, name, monthly_installment, total_members, total_months, start_date, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 20, '2023-06-01', 'ACTIVE', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code, name=EXCLUDED.name, monthly_installment=EXCLUDED.monthly_installment, total_members=EXCLUDED.total_members, total_months=20, start_date='2023-06-01', status='ACTIVE'
      `, [sc.id, ORG_ID, `BISSI-${sc.aliasId}`, sc.name, sc.installment, sc.memberLimit]);
    }
    console.log("✅ 4 Schemes configured.");

    // ── Lucky tokens ──
    const luckyWinnersMap = parseLuckyTokens();
    console.log("✅ Lucky Draw winners loaded.");

    // ── Customer cache: bulk-lookup existing ──
    const existingCusts = await client.query(`SELECT id, name, mobile FROM customers`);
    const customerByPhone = new Map();
    const customerByName = new Map();
    for (const c of existingCusts.rows) {
      if (c.mobile) customerByPhone.set(c.mobile, c.id);
      if (c.name) customerByName.set(c.name.toLowerCase(), c.id);
    }

    // ── PASS 1: Collect all data in memory ──
    const allTokenRows = [];    // [tokenUUID, committeeId, customerUUID, rawTokenStr, status]
    const allLotteryRows = [];  // [committeeId, customerUUID, notes]
    const allCollectionRows = []; // [committeeId, customerIntId, amount, collectedAt, notes]
    const newCustomerRows = [];   // [uuid, orgId, name, mobile, address]

    let customerIntIdMap = new Map(); // customerUUID -> intId
    let nextIntId = 1;

    // Assign intIds to existing customers
    for (const c of existingCusts.rows) {
      customerIntIdMap.set(c.id, nextIntId++);
    }

    const getOrCreateCustomerLocal = (nameRaw, phoneRaw, refNameRaw, addressRaw) => {
      const name = (nameRaw || "Bissi Member").toString().trim();
      const phoneClean = (phoneRaw || "").toString().replace(/[^0-9]/g, '');
      const phoneVal = phoneClean.length >= 10 ? phoneClean.slice(-10) : null;

      // Try phone lookup first
      if (phoneVal && customerByPhone.has(phoneVal)) {
        const id = customerByPhone.get(phoneVal);
        return { id, intId: customerIntIdMap.get(id) };
      }

      // Try name lookup
      if (customerByName.has(name.toLowerCase())) {
        const id = customerByName.get(name.toLowerCase());
        return { id, intId: customerIntIdMap.get(id) };
      }

      // Create new
      const newId = randomUUID();
      const finalPhone = phoneVal || `999${Math.floor(1000000 + Math.random()*9000000)}`;
      const intId = nextIntId++;

      customerByPhone.set(finalPhone, newId);
      customerByName.set(name.toLowerCase(), newId);
      customerIntIdMap.set(newId, intId);
      newCustomerRows.push([newId, ORG_ID, name, finalPhone, addressRaw || null]);

      return { id: newId, intId };
    };

    for (const sc of schemesConfig) {
      const actualSheetName = wb.SheetNames.find(s => s.trim().toLowerCase() === sc.sheetName.trim().toLowerCase());
      if (!actualSheetName) { console.log(`⚠️ Sheet missing for ${sc.name}`); continue; }

      console.log(`Reading scheme: ${sc.name}...`);
      const sheet = wb.Sheets[actualSheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const headers = rows[0] || [];

      const colMonthDates = [];
      for (let c = sc.amtStartCol; c < headers.length; c++) {
        const parsedD = parseExcelDate(headers[c]);
        if (parsedD) colMonthDates[c] = parsedD;
      }

      const seenTokensInScheme = new Map();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row[0] === undefined || row[0] === null || String(row[0]).trim() === '') continue;

        let rawTokStr = String(row[0]).trim();
        let name = row[sc.nameCol];
        let refName = row[sc.refCol];
        let phone = row[sc.phoneCol];
        let address = sc.addressCol !== null ? row[sc.addressCol] : null;
        if (!name && !phone) continue;

        // Duplicate token overrides
        if (sc.id === 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31' && rawTokStr === '443') {
          const count = (seenTokensInScheme.get('443') || 0) + 1;
          seenTokensInScheme.set('443', count);
          rawTokStr = count === 1 ? '443A' : '443B';
        } else if (sc.id === '22222222-2222-2222-2222-222222222222' && rawTokStr === '3') {
          const count = (seenTokensInScheme.get('3') || 0) + 1;
          seenTokensInScheme.set('3', count);
          rawTokStr = count === 1 ? '3A' : '3B';
        }

        const custObj = getOrCreateCustomerLocal(name, phone, refName, address);

        const luckyMap = luckyWinnersMap.get(sc.id);
        const isLucky = luckyMap ? (luckyMap.has(rawTokStr) || luckyMap.has(String(parseInt(rawTokStr, 10)))) : false;
        const status = isLucky ? 'OUT' : 'ACTIVE';
        const tokUUID = randomUUID();

        allTokenRows.push([tokUUID, sc.id, custObj.id, rawTokStr, status]);

        if (isLucky) {
          const luckyMonthStr = luckyMap.get(rawTokStr) || luckyMap.get(String(parseInt(rawTokStr, 10))) || "Mar 2025";
          allLotteryRows.push([parseInt(sc.aliasId, 10), custObj.intId, new Date(), 'completed', `Lucky Winner (${luckyMonthStr}) Token ${rawTokStr}`]);
        }

        for (let c = sc.amtStartCol; c < row.length; c++) {
          const amtVal = row[c];
          if (amtVal !== undefined && amtVal !== null) {
            const amtNum = typeof amtVal === 'number' ? amtVal : parseFloat(String(amtVal).replace(/[^0-9.]/g, ''));
            if (!isNaN(amtNum) && amtNum > 0) {
              const colDate = colMonthDates[c] || new Date(2025, 2, 15);
              allCollectionRows.push([parseInt(sc.aliasId, 10), custObj.intId, amtNum, 'cash', 'verified', colDate, `Token ${rawTokStr}`]);
            }
          }
        }
      }
      console.log(`  ✅ ${sc.name}: read ${allTokenRows.length} total tokens so far`);
    }

    // ── PASS 2: Batch insert everything ──
    console.log(`\nInserting ${newCustomerRows.length} new customers...`);
    await batchInsert(client, 'customers', ['id', 'organization_id', 'name', 'mobile', 'address'], newCustomerRows);
    console.log("✅ Customers inserted.");

    console.log(`Inserting ${allTokenRows.length} tokens...`);
    await batchInsert(client, 'tokens', ['id', 'committee_id', 'customer_id', 'raw_token_number', 'status'], allTokenRows);
    console.log("✅ Tokens inserted.");

    console.log(`Inserting ${allLotteryRows.length} lottery records...`);
    await batchInsert(client, 'lotteries', ['committee_id', 'winner_id', 'draw_date', 'status', 'notes'], allLotteryRows);
    console.log("✅ Lotteries inserted.");

    console.log(`Inserting ${allCollectionRows.length} collection records...`);
    await batchInsert(client, 'collections', ['committee_id', 'customer_id', 'amount', 'payment_mode', 'verification_status', 'collected_at', 'notes'], allCollectionRows, 500);
    console.log("✅ Collections inserted.");

    // ── Daily Diary ── (Skipped: office_diary requires author_user_id which has no users table yet)
    // Will be imported separately once user management is set up.
    console.log("⏭️ Skipping daily diary import (requires author_user_id).");

    await client.query('COMMIT');
    console.log("\n🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log(`   Customers: ${newCustomerRows.length} new`);
    console.log(`   Tokens: ${allTokenRows.length}`);
    console.log(`   Lotteries: ${allLotteryRows.length}`);
    console.log(`   Collections: ${allCollectionRows.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ SEED ERROR:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
