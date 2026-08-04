import XLSX from 'xlsx';
import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi.xlsx';

function parseExcelDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) return new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d));
  }
  const str = String(val).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function cleanPhone(raw) {
  if (!raw) return null;
  const str = String(raw).replace(/\D/g, '');
  if (str.length >= 10) return str.slice(-10);
  return null;
}

function cleanNum(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function fastMasterReimport() {
  console.log('=== STARTING ULTRA-FAST BISSI MASTER DATA REIMPORT ===');
  console.log('Reading workbook:', filePath);

  const startTime = Date.now();
  const workbook = XLSX.readFile(filePath);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ---------------------------------------------------------------------------
    // 1. Clean Reset Transactional Tables
    // ---------------------------------------------------------------------------
    console.log('Cleaning existing transactional data...');
    await client.query(`
      TRUNCATE TABLE 
        collections,
        daily_diary_payments,
        daily_diary_loans,
        gift_distributions,
        lotteries,
        interest_transactions,
        interest_accounts,
        loans,
        tokens,
        customers,
        committees
      RESTART IDENTITY CASCADE;
    `);

    // ---------------------------------------------------------------------------
    // 2. Ensure Branch & Organization
    // ---------------------------------------------------------------------------
    console.log('Ensuring default organization & branch...');
    const orgRes = await client.query(`
      INSERT INTO organizations (id, name, code)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Shree Krishna Association', 'SKA')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const orgId = orgRes.rows[0].id;

    const branchRes = await client.query(`
      INSERT INTO branches (id, name, code, city, status)
      VALUES (1, 'Shree Krishna Associate', 'SKA001', 'Kota', 'active')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const branchId = branchRes.rows[0].id;

    // ---------------------------------------------------------------------------
    // 3. Seed 4 Bissi Schemes
    // ---------------------------------------------------------------------------
    console.log('Seeding 4 Bissi Schemes...');
    const schemeDefs = [
      { id: 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31', intId: 1, code: 'BISSI-1', name: 'Sawariya Seth Bissi (5th Date)', installment: 3000, totalMembers: 500 },
      { id: '33333333-3333-3333-3333-333333333333', intId: 2, code: 'BISSI-2', name: 'Pyare Mohan Bissi (15th Date)', installment: 3000, totalMembers: 500 },
      { id: '11111111-1111-1111-1111-111111111111', intId: 3, code: 'BISSI-3', name: 'Hare Ka Sahara Bissi (20th Date)', installment: 2500, totalMembers: 500 },
      { id: '22222222-2222-2222-2222-222222222222', intId: 4, code: 'BISSI-4', name: 'Shree Krishna Bissi', installment: 3000, totalMembers: 1111 },
    ];

    const committeeMap = new Map();
    for (const def of schemeDefs) {
      const res = await client.query(`
        INSERT INTO committees (id, bissi_int_id, code, name, monthly_installment, total_members, total_months, start_date, end_date, status, organization_id)
        VALUES ($1, $2, $3, $4, $5, $6, 20, '2023-06-01'::date, '2025-01-01'::date, 'ACTIVE', $7)
        ON CONFLICT (organization_id, code) DO UPDATE SET 
          name = EXCLUDED.name,
          monthly_installment = EXCLUDED.monthly_installment,
          bissi_int_id = EXCLUDED.bissi_int_id
        RETURNING id;
      `, [def.id, def.intId, def.code, def.name, def.installment, def.totalMembers, orgId]);
      committeeMap.set(def.code, res.rows[0].id);
      committeeMap.set(String(def.intId), res.rows[0].id);
      committeeMap.set(def.id, res.rows[0].id);
    }

    // ---------------------------------------------------------------------------
    // 4. Collect & Batch Insert Customers
    // ---------------------------------------------------------------------------
    console.log('Collecting customer data across all sheets...');
    const customerList = [];
    const customerPhoneMap = new Map(); // phone -> index in customerList
    const customerNameMap = new Map();  // lowercase name -> index

    let autoPhoneCounter = 10000000;

    function queueCustomer(nameRaw, phoneRaw, refName = '', address = '') {
      if (!nameRaw || typeof nameRaw !== 'string') return null;
      const name = nameRaw.trim();
      if (!name || name.toLowerCase() === 'name' || name.toLowerCase().startsWith('token')) return null;

      const phone = cleanPhone(phoneRaw) || `99${autoPhoneCounter++}`;
      const nameKey = name.toLowerCase();

      if (customerPhoneMap.has(phone)) return customerList[customerPhoneMap.get(phone)].id;
      if (customerNameMap.has(nameKey)) return customerList[customerNameMap.get(nameKey)].id;

      const id = crypto.randomUUID();
      const refNum = `CUST-${phone}`;
      const custObj = { id, refNum, name, phone, address: String(address || ''), refName: String(refName || '') };
      
      const idx = customerList.length;
      customerList.push(custObj);
      customerPhoneMap.set(phone, idx);
      customerNameMap.set(nameKey, idx);
      return id;
    }

    // Process Scheme Sheets to extract Customers & Tokens
    const schemeSheets = [
      { sheet: 'Sawariya seth 5 date', commId: committeeMap.get('BISSI-1') },
      { sheet: 'Pyare mohan 15 date', commId: committeeMap.get('BISSI-2') },
      { sheet: 'Hare ka sahara bissi 20 date', commId: committeeMap.get('BISSI-3') },
      { sheet: 'Shree Krishna associate lottery', commId: committeeMap.get('BISSI-4') }
    ];

    const tokenList = [];

    for (const item of schemeSheets) {
      if (!workbook.SheetNames.includes(item.sheet)) continue;
      const ws = workbook.Sheets[item.sheet];
      const rows = XLSX.utils.sheet_to_json(ws);

      for (const r of rows) {
        const tokenNumRaw = r['token no.'] || r['token no'] || r['Token no:-'] || r['Token No'] || r['Token No:-'];
        const nameRaw = r['Name'] || r['Name.'] || r['Name '] || r['name'];
        const phoneRaw = r['Mobile No:-'] || r['Mobile no '] || r['CONTACT :-'] || r['Mob no.'];
        const refName = r['Reference name'] || r['Reference Name'] || r['Reference'];
        const address = r['Address'] || r['Adress'];

        if (!tokenNumRaw || !nameRaw) continue;
        const normToken = parseInt(String(tokenNumRaw).replace(/\D/g, ''), 10);
        if (isNaN(normToken)) continue;

        const custId = queueCustomer(nameRaw, phoneRaw, refName, address);
        if (!custId) continue;

        tokenList.push({
          id: crypto.randomUUID(),
          committeeId: item.commId,
          customerId: custId,
          rawToken: String(normToken),
          normToken
        });
      }
    }

    // Batch Insert Customers
    console.log(`Batch inserting ${customerList.length} customers into database...`);
    const chunkSize = 500;
    for (let i = 0; i < customerList.length; i += chunkSize) {
      const chunk = customerList.slice(i, i + chunkSize);
      const params = [];
      const valueClauses = chunk.map((c, idx) => {
        const p = idx * 5;
        params.push(c.id, orgId, c.name, c.phone, c.address);
        return `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, 'Kota', 'ACTIVE')`;
      }).join(',');

      await client.query(`
        INSERT INTO customers (id, organization_id, name, mobile, address, city, status)
        VALUES ${valueClauses}
        ON CONFLICT (id) DO NOTHING;
      `, params);
    }

    // Batch Insert Tokens
    console.log(`Batch inserting ${tokenList.length} member tokens...`);
    for (let i = 0; i < tokenList.length; i += chunkSize) {
      const chunk = tokenList.slice(i, i + chunkSize);
      const params = [];
      const valueClauses = chunk.map((t, idx) => {
        const p = idx * 6;
        params.push(t.id, orgId, t.committeeId, t.customerId, t.rawToken, t.normToken);
        return `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, 'ACTIVE')`;
      }).join(',');

      await client.query(`
        INSERT INTO tokens (id, organization_id, committee_id, customer_id, raw_token_number, normalized_token_number, status)
        VALUES ${valueClauses};
      `, params);
    }

    // ---------------------------------------------------------------------------
    // 5. Batch Insert Gift Records & Distributions
    // ---------------------------------------------------------------------------
    console.log('Processing & batch inserting Gift Records...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
      INSERT INTO gifts (id, name) VALUES (1, 'Bissi Scheme Gift') ON CONFLICT (id) DO NOTHING;
    `);

    const giftSheets = [
      { sheet: 'Sawariya seth bissi gift record', commId: committeeMap.get('BISSI-1') },
      { sheet: 'Pyare mohan bissi gift records', commId: committeeMap.get('BISSI-2') },
      { sheet: 'Hare ka sahara bissi gift recor', commId: committeeMap.get('BISSI-3') },
      { sheet: 'Shree krishna aasociates gift r', commId: committeeMap.get('BISSI-4') }
    ];

    const giftList = [];

    for (const gItem of giftSheets) {
      if (!workbook.SheetNames.includes(gItem.sheet)) continue;
      const ws = workbook.Sheets[gItem.sheet];
      const rows = XLSX.utils.sheet_to_json(ws);

      for (const r of rows) {
        const tokenNumRaw = r['Token No'] || r['token no.'] || r['Token No:-'];
        const nameRaw = r['Name'] || r['Name '];
        if (!tokenNumRaw || !nameRaw) continue;

        const normToken = parseInt(String(tokenNumRaw).replace(/\D/g, ''), 10);
        if (isNaN(normToken)) continue;

        const custId = queueCustomer(nameRaw, r[' Mobile no:-'] || r['CONTACT :-']);

        for (const [colKey, colVal] of Object.entries(r)) {
          if (!colVal || typeof colVal !== 'string') continue;
          const strVal = colVal.trim();
          if (!strVal || strVal === 'Name' || strVal === 'Token No' || strVal.includes(':-')) continue;

          const distDate = parseExcelDate(colKey).toISOString();
          
          giftList.push({
            giftName: strVal,
            distDate,
            custName: String(nameRaw).trim(),
            normToken,
            custId,
            commId: gItem.commId,
            notes: `Imported from ${gItem.sheet}`
          });
        }
      }
    }

    for (let i = 0; i < giftList.length; i += chunkSize) {
      const chunk = giftList.slice(i, i + chunkSize);
      const params = [];
      const valueClauses = chunk.map((g, idx) => {
        const p = idx * 8;
        params.push(branchId, g.giftName, g.distDate, g.custName, g.normToken, g.custId, g.commId, g.notes);
        return `(1, 1, $${p + 1}, $${p + 2}, 'distributed', $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, $${p + 7}, $${p + 8})`;
      }).join(',');

      await client.query(`
        INSERT INTO gift_distributions (
          gift_id, customer_id, branch_id, gift_name, status, distribution_date, 
          customer_name, token_number, customer_uuid, committee_uuid, notes
        ) VALUES ${valueClauses};
      `, params);
    }
    console.log(`Batch inserted ${giftList.length} Gift Distributions.`);

    // ---------------------------------------------------------------------------
    // 6. Batch Insert Interest Accounts & Transactions (`BYAJ KI LIST`)
    // ---------------------------------------------------------------------------
    console.log('Processing Interest Accounts & Transactions (BYAJ KI LIST)...');
    const interestAccList = [];
    const interestTxList = [];

    if (workbook.SheetNames.includes('BYAJ KI LIST')) {
      const ws = workbook.Sheets['BYAJ KI LIST'];
      const rows = XLSX.utils.sheet_to_json(ws);

      for (const r of rows) {
        const nameRaw = r['Name'];
        const amountRaw = r['INTEREST AMOUNT'] || r['Amount'];
        if (!nameRaw || !amountRaw) continue;

        const amount = cleanNum(amountRaw);
        if (amount <= 0) continue;

        const safeAmt = Math.min(amount, 9999999);
        const principal = safeAmt * 10;
        const monthlyInt = safeAmt;

        const custId = queueCustomer(nameRaw, r['Mobile no:-'] || r['Reference mobile no:-'], '', r['Adress'] || r['Address']);
        const intDate = parseExcelDate(r['Interest date']);
        const accId = interestAccList.length + 1;

        interestAccList.push({
          accId,
          custId,
          principal,
          monthlyInt,
          notes: String(r['Reason1'] || r['Reply'] || ''),
          intDate
        });

        interestTxList.push({
          accId,
          custId,
          amount: safeAmt,
          month: intDate.getMonth() + 1,
          year: intDate.getFullYear(),
          intDate,
          notes: String(r['Reply'] || 'Interest Payment')
        });
      }
    }

    if (interestAccList.length > 0) {
      for (let i = 0; i < interestAccList.length; i += chunkSize) {
        const chunk = interestAccList.slice(i, i + chunkSize);
        const params = [];
        const valueClauses = chunk.map((a, idx) => {
          const p = idx * 7;
          params.push(a.accId, a.principal, a.monthlyInt, a.notes, branchId, a.intDate.toISOString().split('T')[0], a.intDate.toISOString());
          return `($${p + 1}, 1, $${p + 2}, 2.0, $${p + 6}::date, $${p + 3}, 0, 'active', $${p + 4}, $${p + 5}, $${p + 7}::timestamptz)`;
        }).join(',');

        await client.query(`
          INSERT INTO interest_accounts (
            id, customer_id, principal_amount, interest_rate, start_date, monthly_interest, pending_interest, 
            status, notes, branch_id, created_at
          ) VALUES ${valueClauses};
        `, params);
      }

      for (let i = 0; i < interestTxList.length; i += chunkSize) {
        const chunk = interestTxList.slice(i, i + chunkSize);
        const params = [];
        const valueClauses = chunk.map((tx, idx) => {
          const p = idx * 7;
          params.push(tx.accId, tx.amount, tx.month, tx.year, tx.intDate.toISOString(), tx.notes, branchId);
          return `($${p + 1}, 1, 'credit', $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}::timestamptz, $${p + 6}, $${p + 7})`;
        }).join(',');

        await client.query(`
          INSERT INTO interest_transactions (
            account_id, customer_id, type, amount, month, year, payment_date, notes, branch_id
          ) VALUES ${valueClauses};
        `, params);
      }
    }
    console.log(`Batch inserted ${interestAccList.length} Interest Accounts & Transactions.`);

    // ---------------------------------------------------------------------------
    // 7. Batch Insert Daily Diary (`daily diary`)
    // ---------------------------------------------------------------------------
    console.log('Processing & batch inserting Daily Diary records...');
    const diaryList = [];
    if (workbook.SheetNames.includes('daily diary')) {
      const ws = workbook.Sheets['daily diary'];
      const rows = XLSX.utils.sheet_to_json(ws);

      for (const r of rows) {
        const nameRaw = r['NAME'];
        const loanAmtRaw = r['Loan AMOUNT'] || r['AMOUNT TAKEN'];
        if (!nameRaw) continue;

        const loanAmount = cleanNum(loanAmtRaw);
        const startDateStr = parseExcelDate(r['START DATE']).toISOString().split('T')[0];
        const endDateStr = parseExcelDate(r['COMPLETE DATE']).toISOString().split('T')[0];

        diaryList.push({
          name: String(nameRaw).trim(),
          mobile: String(r['MOBILE NO:-'] || ''),
          refMobile: String(r['REFERENCE MOBILE NO:-'] || ''),
          address: String(r['ADDRESS'] || ''),
          security: String(r['SECURITY'] || ''),
          loanAmount,
          startDateStr,
          endDateStr,
          mode: String(r['Payment Mode'] || 'DAILY'),
          notes: String(r['REASON'] || r['REMAINING TILL TODAY'] || '')
        });
      }
    }

    if (diaryList.length > 0) {
      for (let i = 0; i < diaryList.length; i += chunkSize) {
        const chunk = diaryList.slice(i, i + chunkSize);
        const params = [];
        const valueClauses = chunk.map((d, idx) => {
          const p = idx * 11;
          params.push(orgId, d.name, d.mobile, d.refMobile, d.address, d.security, d.loanAmount, d.startDateStr, d.endDateStr, d.mode, d.notes);
          return `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, $${p + 7}, $${p + 8}, $${p + 9}, $${p + 10}, $${p + 11}, 'active')`;
        }).join(',');

        await client.query(`
          INSERT INTO daily_diary_loans (
            organization_id, customer_name, mobile_number, reference_mobile_numbers,
            address, security, loan_amount, start_date, expected_complete_date,
            collection_plan, notes, status
          ) VALUES ${valueClauses};
        `, params);
      }
    }
    console.log(`Inserted ${diaryList.length} Daily Diary loans.`);

    // ---------------------------------------------------------------------------
    // 8. Batch Insert Daily Collections
    // ---------------------------------------------------------------------------
    console.log('Processing & batch inserting Daily Collections...');
    const collectionSheets = [
      'Daily collection',
      'Collection office (aayush)',
      'Manager collection',
      'online collection (nikku)'
    ];

    const collList = [];

    for (const cSheet of collectionSheets) {
      if (!workbook.SheetNames.includes(cSheet)) continue;
      const ws = workbook.Sheets[cSheet];
      const rows = XLSX.utils.sheet_to_json(ws);

      for (const r of rows) {
        const nameRaw = r['Name'];
        const cashCredit = cleanNum(r['CREDIT (जमा) (cash) ']);
        const onlineCredit = cleanNum(r['CREDIT (जमा) (ONLINE)']);
        const totalCredit = Math.min(cashCredit + onlineCredit, 9999999);

        if (!nameRaw || totalCredit <= 0) continue;

        const collDate = parseExcelDate(r['DATE']).toISOString();
        const payMode = onlineCredit > 0 ? 'upi' : 'cash';
        const custId = queueCustomer(nameRaw, '');

        let commUuid = committeeMap.get('BISSI-1');
        if (r['15th date bissi'] || r['15th date bissi token no:']) commUuid = committeeMap.get('BISSI-2');
        if (r['20th date bissi'] || r['20th date bissi token no:-']) commUuid = committeeMap.get('BISSI-3');

        collList.push({
          amount: totalCredit,
          payMode,
          notes: `Imported from ${cSheet}`,
          collDate,
          name: String(nameRaw).trim(),
          custId,
          commUuid
        });
      }
    }

    const collChunkSize = 1000;
    for (let i = 0; i < collList.length; i += collChunkSize) {
      const chunk = collList.slice(i, i + collChunkSize);
      const params = [];
      const valueClauses = chunk.map((c, idx) => {
        const p = idx * 7;
        params.push(branchId, c.amount, c.payMode, c.notes, c.collDate, c.custId, c.commUuid);
        return `(1, $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}::timestamptz, $${p + 6}, $${p + 7})`;
      }).join(',');

      await client.query(`
        INSERT INTO collections (
          customer_id, branch_id, amount, payment_mode, notes, collected_at, 
          customer_uuid, committee_uuid
        ) VALUES ${valueClauses};
      `, params);
    }
    console.log(`Batch inserted ${collList.length} Collection transactions.`);

    // ---------------------------------------------------------------------------
    // 9. Batch Insert Lotteries & Winner Records
    // ---------------------------------------------------------------------------
    console.log('Processing & batch inserting Lotteries & Winners...');
    const lotteryList = [];
    if (workbook.SheetNames.includes('Shree Krishna associate lottery')) {
      const ws = workbook.Sheets['Shree Krishna associate lottery'];
      const rows = XLSX.utils.sheet_to_json(ws);

      for (const r of rows) {
        const tokenNumRaw = r['Token no:-'];
        const nameRaw = r['Name '];
        if (!tokenNumRaw || !nameRaw) continue;

        const normToken = parseInt(String(tokenNumRaw).replace(/\D/g, ''), 10);
        if (isNaN(normToken)) continue;

        const custId = queueCustomer(nameRaw, r['Mob no.']);
        const commUuid = committeeMap.get('BISSI-4');

        lotteryList.push({
          commUuid,
          custId,
          normToken,
          desc: String(r['reason'] || 'Lucky Winner')
        });
      }
    }

    if (lotteryList.length > 0) {
      for (let i = 0; i < lotteryList.length; i += chunkSize) {
        const chunk = lotteryList.slice(i, i + chunkSize);
        const params = [];
        const valueClauses = chunk.map((l, idx) => {
          const p = idx * 4;
          params.push(l.commUuid, l.custId, l.normToken, l.desc);
          return `(1, 1, $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, 'completed', CURRENT_DATE)`;
        }).join(',');

        await client.query(`
          INSERT INTO lotteries (
            committee_id, winner_id, committee_uuid, winner_customer_uuid, token_number, 
            reward_description, status, draw_date
          ) VALUES ${valueClauses};
        `, params);
      }
    }
    console.log(`Batch inserted ${lotteryList.length} Lottery Winner records.`);

    await client.query('COMMIT');
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`=== ULTRA-FAST MASTER REIMPORT COMPLETED IN ${elapsed}s ===`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FATAL ERROR DURING REIMPORT:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fastMasterReimport();
