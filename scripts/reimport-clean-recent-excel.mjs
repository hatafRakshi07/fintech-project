import XLSX from 'xlsx';
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (2).xlsx';

function cleanPhone(raw) {
  if (!raw) return null;
  const str = String(raw).replace(/\D/g, '');
  if (str.length >= 10) return str.slice(-10);
  return null;
}

function cleanName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim();
  if (!clean || clean.toLowerCase().includes('token') || clean.toLowerCase().includes('name') || clean.toLowerCase().includes('total') || clean.toLowerCase().includes('recheck')) return '';
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

// Generate deterministic key for customer deduplication
function getCustomerKey(name, phoneRaw) {
  const cName = cleanName(name);
  if (!cName) return null;
  const phone = cleanPhone(phoneRaw);
  if (phone) return `PHONE:${phone}`;
  // If no valid phone, hash the cleaned name to prevent duplicates
  const nameHash = crypto.createHash('md5').update(cName.toLowerCase()).digest('hex').slice(0, 10);
  return `NAME:${nameHash}`;
}

async function runCleanImport() {
  console.log(`[Clean Excel Import] Opening file: ${filePath}`);
  const startTime = Date.now();
  const workbook = XLSX.readFile(filePath);
  const client = await pool.connect();

  try {
    console.log('[Clean Excel Import] Connected to Neon PostgreSQL DB.');

    // Step 1: Truncate existing data to remove all previous duplicates!
    console.log('[Clean Excel Import] Wiping existing duplicate data from DB...');
    await client.query(`
      TRUNCATE TABLE 
        notifications,
        collections, 
        interest_transactions, 
        interest_accounts, 
        loans, 
        tokens, 
        committee_members, 
        committees, 
        customers, 
        branches 
      RESTART IDENTITY CASCADE;
    `);
    console.log('[Clean Excel Import] ✓ DB Tables wiped cleanly.');

    // Step 2: Insert Main Branch
    const branchRes = await client.query(`
      INSERT INTO branches (name, code, city, address, phone)
      VALUES ('Main Branch - Kota', 'BR-KOTA-01', 'Kota', 'Kota, Rajasthan', '9950417777')
      RETURNING id;
    `);
    const branchId = branchRes.rows[0].id;

    // Step 3: Parse Excel sheets & build unique customer map
    const customerMap = new Map(); // key -> { name, mobile, address, refName, refNum }

    function registerCustomer(name, phoneRaw, refName = '', address = '') {
      const cName = cleanName(name);
      if (!cName) return null;

      const key = getCustomerKey(cName, phoneRaw);
      if (!key) return null;

      if (!customerMap.has(key)) {
        let mobile = cleanPhone(phoneRaw);
        if (!mobile) {
          // Deterministic mobile number from key hash
          const hashDigits = crypto.createHash('md5').update(key).digest('hex').replace(/\D/g, '').slice(0, 8);
          mobile = `99${hashDigits.padStart(8, '0')}`;
        }
        const refNum = `CUST-${mobile}`;
        customerMap.set(key, { key, name: cName, mobile, address: String(address || ''), refName: String(refName || ''), refNum });
      }
      return key;
    }

    // Parse Bissi Sheets
    const bissiSheets = [
      { sheetName: 'Sawariya seth 5 date', name: 'Sawariya Seth Bissi (5th Date)', installment: 3000, memberLimit: 20, duration: 20 },
      { sheetName: 'Pyare mohan 15 date', name: 'Pyare Mohan Bissi (15th Date)', installment: 3000, memberLimit: 20, duration: 20 },
      { sheetName: 'Hare ka sahara bissi 20 date', name: 'Hare Ka Sahara Bissi (20th Date)', installment: 3000, memberLimit: 20, duration: 20 },
      { sheetName: 'Shree Krishna associate lottery', name: 'Shree Krishna Lottery Scheme', installment: 3000, memberLimit: 20, duration: 20 },
    ];

    const parsedTokens = [];
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

        const key = registerCustomer(cName, mobile, refName, address);
        if (key) {
          parsedTokens.push({ committeeName: b.name, installment: b.installment, memberLimit: b.memberLimit, duration: b.duration, tokenNo, key });
        }
      }
    }

    // Parse Collection Sheets
    const collectionSheets = ['Daily collection', 'Manager collection', 'Aayush collection', 'online collection(nikku ji)', 'recovery collection'];
    const parsedCollections = [];
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
        const key = registerCustomer(cName, '');
        if (!key) continue;

        const dateStr = excelDateToISO(dateVal);
        if (cashCredit > 0 && cashCredit <= 10000000) parsedCollections.push({ key, amount: cashCredit, mode: 'cash', date: dateStr });
        if (onlineCredit > 0 && onlineCredit <= 10000000) parsedCollections.push({ key, amount: onlineCredit, mode: 'upi', date: dateStr });
      }
    }

    // Parse Interest List
    const parsedInterests = [];
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
        const key = registerCustomer(cName, mobile, refName, address);
        if (key) parsedInterests.push({ key, amount: interestAmt });
      }
    }

    // Parse Loans
    const loanSheets = ['nikku ji loan', 'Aayush ji loan', 'Priti ji loan', 'Pooja ji loan'];
    const parsedLoans = [];
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

        const key = registerCustomer(cName, '');
        if (!key) continue;
        const principal = loanAmt > 0 ? loanAmt : depositAmt;
        if (principal > 0 && principal <= 10000000) {
          parsedLoans.push({ key, loanNo: `LN-${sName.replace(/[^a-zA-Z]/g, '')}-${i}`, principal });
        }
      }
    }

    console.log(`[Clean Excel Import] Parsed exact unique data from Excel:`);
    console.log(`- Clean Unique Customers: ${customerMap.size}`);
    console.log(`- Bissi Tokens: ${parsedTokens.length}`);
    console.log(`- Daily Collections: ${parsedCollections.length}`);
    console.log(`- Interest Accounts: ${parsedInterests.length}`);
    console.log(`- Loans: ${parsedLoans.length}`);

    // BULK INSERT CLEAN CUSTOMERS
    console.log('[Clean Excel Import] Bulk inserting clean customers...');
    const custArray = Array.from(customerMap.values());
    const customerDbMap = new Map(); // key -> id
    const chunkSize = 200;

    for (let i = 0; i < custArray.length; i += chunkSize) {
      const chunk = custArray.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const c of chunk) {
        values.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5})`);
        params.push(c.refNum, c.name, c.mobile, c.address, c.refName, branchId);
        pIdx += 6;
      }

      const res = await client.query(`
        INSERT INTO customers (reference_number, name, mobile, address, reference_name, branch_id)
        VALUES ${values.join(', ')}
        RETURNING id, mobile, reference_number;
      `, params);

      res.rows.forEach(r => {
        // Find matching key
        for (const c of chunk) {
          if (c.refNum === r.reference_number) {
            customerDbMap.set(c.key, r.id);
          }
        }
      });
    }

    console.log(`[Clean Excel Import] Inserted ${customerDbMap.size} clean customers.`);

    // BULK INSERT COMMITTEES & TOKENS
    const committeeIdMap = new Map();
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
        const custId = customerDbMap.get(t.key);
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
    console.log('[Clean Excel Import] Bulk inserting collections...');
    for (let i = 0; i < parsedCollections.length; i += chunkSize) {
      const chunk = parsedCollections.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const col of chunk) {
        const custId = customerDbMap.get(col.key);
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
    console.log('[Clean Excel Import] Bulk inserting interest accounts...');
    for (let i = 0; i < parsedInterests.length; i += chunkSize) {
      const chunk = parsedInterests.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const item of chunk) {
        const custId = customerDbMap.get(item.key);
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
    console.log('[Clean Excel Import] Bulk inserting loans...');
    for (let i = 0; i < parsedLoans.length; i += chunkSize) {
      const chunk = parsedLoans.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const l of chunk) {
        const custId = customerDbMap.get(l.key);
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
    console.log(`🎉 [CLEAN RE-IMPORT SUCCESSFUL in ${elapsed}s]`);
    console.log(`- Exact Unique Customers: ${customerDbMap.size}`);
    console.log(`- Bissi Committees: ${bissiSheets.length}`);
    console.log(`- Bissi Tokens: ${parsedTokens.length}`);
    console.log(`- Daily Collections: ${parsedCollections.length}`);
    console.log(`- Interest Accounts: ${parsedInterests.length}`);
    console.log(`- Loans: ${parsedLoans.length}`);
    console.log(`=================================================\n`);

  } catch (err) {
    console.error('[Clean Import Error]', err);
  } finally {
    await client.release();
    await pool.end();
  }
}

runCleanImport();
