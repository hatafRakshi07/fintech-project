import XLSX from 'xlsx';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const filePath = 'C:\\Users\\iSN_kota_T52\\Downloads\\Bissi folder.xlsx';

function cleanPhone(raw) {
  if (!raw) return null;
  const str = String(raw).replace(/\D/g, '');
  if (str.length >= 10) return str.slice(-10);
  return null;
}

function cleanName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim();
  if (!clean || clean.toLowerCase().includes('token') || clean.toLowerCase().includes('name') || clean.toLowerCase().includes('total')) return '';
  return clean;
}

function cleanNum(val) {
  if (val === null || val === undefined) return 0;
  const n = Number(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function excelDateToISO(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d && d.y && d.m && d.d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const str = String(val).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

async function runFastImport() {
  console.log(`[Fast Excel Import] Opening file: ${filePath}`);
  const startTime = Date.now();
  const workbook = XLSX.readFile(filePath);
  const client = await pool.connect();

  try {
    console.log('[Fast Excel Import] Connected to Neon PostgreSQL DB.');

    // 1. Ensure Main Branch
    const branchRes = await client.query(`
      INSERT INTO branches (name, code, city, address, phone)
      VALUES ('Main Branch - Kota', 'BR-KOTA-01', 'Kota', 'Kota, Rajasthan', '9950417777')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const branchId = branchRes.rows[0].id;

    // Collect all customer records to bulk insert
    const pendingCustomersMap = new Map(); // mobile -> { name, mobile, address, refName }

    function addPendingCustomer(name, phoneRaw, refName = '', address = '') {
      const cName = cleanName(name);
      if (!cName) return null;
      const phone = cleanPhone(phoneRaw) || `99${Math.floor(10000000 + Math.random() * 90000000)}`;
      if (!pendingCustomersMap.has(phone)) {
        pendingCustomersMap.set(phone, { name: cName, mobile: phone, address: String(address || ''), refName: String(refName || '') });
      }
      return phone;
    }

    // Parse Bissi Sheets
    const bissiSheets = [
      { sheetName: 'Sawariya seth 5 date', name: 'Sawariya Seth Bissi (5th Date)', installment: 3000, memberLimit: 20, duration: 20 },
      { sheetName: 'Pyare mohan 15 date', name: 'Pyare Mohan Bissi (15th Date)', installment: 3000, memberLimit: 20, duration: 20 },
      { sheetName: 'Hare ka sahara bissi 20 date', name: 'Hare Ka Sahara Bissi (20th Date)', installment: 3000, memberLimit: 20, duration: 20 },
      { sheetName: 'Shree Krishna associate lottery', name: 'Shree Krishna Lottery Scheme', installment: 3000, memberLimit: 20, duration: 20 },
    ];

    const parsedTokens = []; // { committeeName, tokenNo, phone }
    for (const b of bissiSheets) {
      if (!workbook.SheetNames.includes(b.sheetName)) continue;
      const sheet = workbook.Sheets[b.sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 2) continue;

        const tokenNo = String(r[0] || i).trim();
        const cName = String(r[1] || '').trim();
        const refName = String(r[2] || '').trim();
        const mobile = r[3] || r[4];
        const address = String(r[5] || '').trim();

        const phone = addPendingCustomer(cName, mobile, refName, address);
        if (phone) {
          parsedTokens.push({ committeeName: b.name, installment: b.installment, memberLimit: b.memberLimit, duration: b.duration, tokenNo, phone });
        }
      }
    }

    // Parse Collection Sheets
    const collectionSheets = ['Daily collection', 'Manager collection', 'Aayush collection', 'online collection(nikku ji)', 'recovery collection'];
    const parsedCollections = []; // { phone, amount, mode, date }
    for (const sName of collectionSheets) {
      if (!workbook.SheetNames.includes(sName)) continue;
      const sheet = workbook.Sheets[sName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 3) continue;

        const cName = String(r[0] || '').trim();
        const dateVal = r[1];
        const cashCredit = cleanNum(r[2]);
        const onlineCredit = cleanNum(r[3]);

        if (!cName || (cashCredit === 0 && onlineCredit === 0)) continue;
        const phone = addPendingCustomer(cName, '');
        if (!phone) continue;

        const dateStr = excelDateToISO(dateVal);
        if (cashCredit > 0 && cashCredit <= 10000000) parsedCollections.push({ phone, amount: cashCredit, mode: 'cash', date: dateStr });
        if (onlineCredit > 0 && onlineCredit <= 10000000) parsedCollections.push({ phone, amount: onlineCredit, mode: 'upi', date: dateStr });
      }
    }

    // Parse Interest List
    const parsedInterests = []; // { phone, amount }
    if (workbook.SheetNames.includes('BYAJ KI LIST')) {
      const sheet = workbook.Sheets['BYAJ KI LIST'];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 3) continue;
        const cName = String(r[0] || '').trim();
        const refName = String(r[1] || '').trim();
        const address = String(r[2] || '').trim();
        const mobile = r[3];
        const interestAmt = cleanNum(r[6]);

        if (!cName || interestAmt <= 0 || interestAmt > 10000000) continue;
        const phone = addPendingCustomer(cName, mobile, refName, address);
        if (phone) parsedInterests.push({ phone, amount: interestAmt, index: i });
      }
    }

    // Parse Loans
    const loanSheets = ['nikku ji loan', 'Aayush ji loan', 'Priti ji loan', 'Pooja ji loan'];
    const parsedLoans = []; // { phone, loanNo, amount }
    for (const sName of loanSheets) {
      if (!workbook.SheetNames.includes(sName)) continue;
      const sheet = workbook.Sheets[sName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 7) continue;
        const cName = String(r[0] || '').trim();
        const loanAmt = cleanNum(r[6]);
        const depositAmt = cleanNum(r[7]);
        if (!cName || (loanAmt === 0 && depositAmt === 0)) continue;

        const phone = addPendingCustomer(cName, '');
        if (!phone) continue;
        const principal = loanAmt > 0 ? loanAmt : depositAmt;
        if (principal > 0 && principal <= 10000000) {
          parsedLoans.push({ phone, loanNo: `LN-${sName.replace(/[^a-zA-Z]/g, '')}-${i}`, principal });
        }
      }
    }

    console.log(`[Fast Excel Import] Excel parsing completed:`);
    console.log(`- Unique Customers to sync: ${pendingCustomersMap.size}`);
    console.log(`- Bissi Tokens: ${parsedTokens.length}`);
    console.log(`- Collections: ${parsedCollections.length}`);
    console.log(`- Interest Accounts: ${parsedInterests.length}`);
    console.log(`- Loans: ${parsedLoans.length}`);

    // BULK INSERT CUSTOMERS in Chunks of 200
    console.log('[Fast Excel Import] Bulk inserting customers into Neon DB...');
    const custArray = Array.from(pendingCustomersMap.values());
    const chunkSize = 200;

    for (let i = 0; i < custArray.length; i += chunkSize) {
      const chunk = custArray.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const c of chunk) {
        values.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5})`);
        params.push(`CUST-${c.mobile}`, c.name, c.mobile, c.address, c.refName, branchId);
        pIdx += 6;
      }

      const queryText = `
        INSERT INTO customers (reference_number, name, mobile, address, reference_name, branch_id)
        VALUES ${values.join(', ')}
        ON CONFLICT (reference_number) DO UPDATE SET name = EXCLUDED.name;
      `;
      await client.query(queryText, params);
    }

    // Reload customer map (mobile -> id)
    const allCustRes = await client.query(`SELECT id, mobile FROM customers;`);
    const customerDbMap = new Map();
    allCustRes.rows.forEach(r => customerDbMap.set(r.mobile, r.id));
    console.log(`[Fast Excel Import] Synced ${customerDbMap.size} customer IDs in memory cache.`);

    // BULK INSERT COMMITTEES & TOKENS
    const committeeIdMap = new Map(); // name -> id
    for (const b of bissiSheets) {
      const commRes = await client.query(`
        INSERT INTO committees (name, type, installment_amount, member_limit, duration, branch_id)
        VALUES ($1, 'monthly', $2, $3, $4, $5)
        RETURNING id;
      `, [b.name, b.installment, b.memberLimit, b.duration, branchId]);
      committeeIdMap.set(b.name, commRes.rows[0].id);
    }

    for (let i = 0; i < parsedTokens.length; i += chunkSize) {
      const chunk = parsedTokens.slice(i, i + chunkSize);
      const tokenValues = [];
      const memberValues = [];
      const tokenParams = [];
      const memberParams = [];
      let tIdx = 1;
      let mIdx = 1;

      for (const t of chunk) {
        const commId = committeeIdMap.get(t.committeeName);
        const custId = customerDbMap.get(t.phone);
        if (!commId || !custId) continue;

        tokenValues.push(`($${tIdx}, $${tIdx+1}, $${tIdx+2}, 'active')`);
        tokenParams.push(t.tokenNo, commId, custId);
        tIdx += 3;

        memberValues.push(`($${mIdx}, $${mIdx+1}, $${mIdx+2}, 'active')`);
        memberParams.push(commId, custId, t.tokenNo);
        mIdx += 3;
      }

      if (tokenValues.length > 0) {
        await client.query(`INSERT INTO tokens (token_number, committee_id, customer_id, status) VALUES ${tokenValues.join(', ')};`, tokenParams);
        await client.query(`INSERT INTO committee_members (committee_id, customer_id, token_number, status) VALUES ${memberValues.join(', ')};`, memberParams);
      }
    }

    // BULK INSERT COLLECTIONS
    console.log('[Fast Excel Import] Bulk inserting collections...');
    for (let i = 0; i < parsedCollections.length; i += chunkSize) {
      const chunk = parsedCollections.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const col of chunk) {
        const custId = customerDbMap.get(col.phone);
        if (!custId) continue;

        const receiptNo = `REC-${Date.now()}-${pIdx}`;
        values.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}::timestamp, 'verified', $${pIdx+5})`);
        params.push(receiptNo, custId, col.amount, col.mode, col.date, branchId);
        pIdx += 6;
      }

      if (values.length > 0) {
        await client.query(`
          INSERT INTO collections (receipt_number, customer_id, amount, payment_mode, collected_at, verification_status, branch_id)
          VALUES ${values.join(', ')};
        `, params);
      }
    }

    // BULK INSERT INTEREST ACCOUNTS
    console.log('[Fast Excel Import] Bulk inserting interest accounts...');
    for (let i = 0; i < parsedInterests.length; i += chunkSize) {
      const chunk = parsedInterests.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const item of chunk) {
        const custId = customerDbMap.get(item.phone);
        if (!custId) continue;

        values.push(`($${pIdx}, $${pIdx+1}, 2.0, CURRENT_DATE, 'active', $${pIdx+2})`);
        params.push(custId, item.amount, branchId);
        pIdx += 3;
      }

      if (values.length > 0) {
        await client.query(`
          INSERT INTO interest_accounts (customer_id, principal_amount, interest_rate, start_date, status, branch_id)
          VALUES ${values.join(', ')};
        `, params);
      }
    }

    // BULK INSERT LOANS
    console.log('[Fast Excel Import] Bulk inserting loans...');
    for (let i = 0; i < parsedLoans.length; i += chunkSize) {
      const chunk = parsedLoans.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const l of chunk) {
        const custId = customerDbMap.get(l.phone);
        if (!custId) continue;

        const emi = (l.principal / 12).toFixed(2);
        values.push(`($${pIdx}, $${pIdx+1}, 12.0, 12, $${pIdx+2}, $${pIdx+3}, 'active', $${pIdx+4})`);
        params.push(custId, l.principal, emi, l.principal, branchId);
        pIdx += 5;
      }

      if (values.length > 0) {
        await client.query(`
          INSERT INTO loans (customer_id, principal_amount, interest_rate, tenure, emi_amount, total_amount, status, branch_id)
          VALUES ${values.join(', ')};
        `, params);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n=================================================`);
    console.log(`🎉 [BULK EXCEL IMPORT FINISHED IN ${elapsed} SECONDS!]`);
    console.log(`- Synced Customers: ${customerDbMap.size}`);
    console.log(`- Bissi Committees: ${bissiSheets.length}`);
    console.log(`- Bissi Tokens: ${parsedTokens.length}`);
    console.log(`- Daily Collections: ${parsedCollections.length}`);
    console.log(`- Interest Accounts: ${parsedInterests.length}`);
    console.log(`- Loans: ${parsedLoans.length}`);
    console.log(`=================================================\n`);

  } catch (err) {
    console.error('[Fast Excel Import Error]', err);
  } finally {
    await client.release();
    await pool.end();
  }
}

runFastImport();
