import XLSX from 'xlsx';
import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL || 'postgresql://postgres:shreeassociation2026@db.ovtzfzeodcksosfwjibf.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

const filePath = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (1).xlsx';

async function fastImport() {
  console.log('Reading Excel file:', filePath);
  const startTime = Date.now();
  const workbook = XLSX.readFile(filePath);
  const client = await pool.connect();

  try {
    console.log('Starting ultra-fast batched import into Supabase PostgreSQL...');

    // 1. Main Branch
    const branchRes = await client.query(`
      INSERT INTO branches (name, code, address, phone)
      VALUES ('Main Branch - Kota', 'BR-KOTA-01', 'Kota, Rajasthan', '9950417777')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const branchId = branchRes.rows[0].id;

    // Load existing customers map (mobile -> id)
    const existing = await client.query(`SELECT id, mobile FROM customers;`);
    const customerMap = new Map();
    existing.rows.forEach(r => customerMap.set(r.mobile, r.id));
    console.log(`Loaded ${customerMap.size} existing customers from DB.`);

    function cleanPhone(raw) {
      if (!raw) return null;
      const str = String(raw).replace(/\D/g, '');
      if (str.length >= 10) return str.slice(-10);
      return null;
    }

    // Helper to batch register customers
    async function getOrRegisterCustomer(name, phoneRaw, refName = '', address = '') {
      if (!name || typeof name !== 'string') return null;
      const cleanName = name.trim();
      if (!cleanName || cleanName.toLowerCase().includes('token') || cleanName.toLowerCase().includes('name')) return null;

      const phone = cleanPhone(phoneRaw) || `99${Math.floor(10000000 + Math.random() * 90000000)}`;
      if (customerMap.has(phone)) {
        return customerMap.get(phone);
      }

      const refNum = `CUST-${phone}`;
      try {
        const res = await client.query(`
          INSERT INTO customers (reference_number, name, mobile, address, reference_name, branch_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name
          RETURNING id;
        `, [refNum, cleanName, phone, String(address || ''), String(refName || ''), branchId]);

        const id = res.rows[0].id;
        customerMap.set(phone, id);
        return id;
      } catch {
        return null;
      }
    }

    let totalTokens = 0;
    let totalLoans = 0;
    let totalCollections = 0;

    // 2. Bissi Schemes & Tokens
    const bissiSheets = [
      { name: 'Sawariya seth 5 date', committeeName: 'Sawariya Seth Bissi (5th Date)', installment: 3000, totalAmount: 60000, totalMonths: 20 },
      { name: 'Pyare mohan 15 date', committeeName: 'Pyare Mohan Bissi (15th Date)', installment: 3000, totalAmount: 60000, totalMonths: 20 },
      { name: 'Hare ka sahara bissi 20 date', committeeName: 'Hare Ka Sahara Bissi (20th Date)', installment: 3000, totalAmount: 60000, totalMonths: 20 }
    ];

    for (const bSheet of bissiSheets) {
      if (!workbook.SheetNames.includes(bSheet.name)) continue;

      const commRes = await client.query(`
        INSERT INTO committees (name, total_amount, monthly_installment, total_months, start_date, branch_id)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
        RETURNING id;
      `, [bSheet.committeeName, bSheet.totalAmount, bSheet.installment, bSheet.totalMonths, branchId]);
      const committeeId = commRes.rows[0].id;

      const sheet = workbook.Sheets[bSheet.name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const tokenNo = parseInt(row[0]);
        const custName = row[1];
        const refName = row[2];
        const mobile = row[3];
        const address = row[5];

        if (custName && typeof custName === 'string') {
          const custId = await getOrRegisterCustomer(custName, mobile, refName, address);
          if (custId && !isNaN(tokenNo)) {
            try {
              await client.query(`
                INSERT INTO tokens (committee_id, customer_id, token_number, status)
                VALUES ($1, $2, $3, 'active');
              `, [committeeId, custId, tokenNo]);
              totalTokens++;
            } catch {}
          }
        }
      }
      console.log(`✓ Processed committee "${bSheet.committeeName}".`);
    }

    // 3. OUTER Customers list
    if (workbook.SheetNames.includes('OUTER Customers list')) {
      const sheet = workbook.Sheets['OUTER Customers list'];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row && row[0]) {
          await getOrRegisterCustomer(row[0], row[1], '', row[2]);
        }
      }
      console.log('✓ Processed OUTER Customers list.');
    }

    // 4. Loans
    const loanSheets = ['daily diary', 'nikku ji loan', 'Vansh ji loan', 'Aayush ji loan', 'Priti ji loan', 'Pooja ji loan'];
    for (const lSheetName of loanSheets) {
      if (!workbook.SheetNames.includes(lSheetName)) continue;
      const sheet = workbook.Sheets[lSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const name = row[0];
        const mobile = row[1];
        const amount = parseFloat(row[7] || row[2] || row[3]);

        if (name && typeof name === 'string' && !isNaN(amount) && amount > 0) {
          const custId = await getOrRegisterCustomer(name, mobile);
          if (custId) {
            try {
              await client.query(`
                INSERT INTO loans (customer_id, amount, interest_rate, duration_months, status)
                VALUES ($1, $2, 12.0, 12, 'active');
              `, [custId, amount]);
              totalLoans++;
            } catch {}
          }
        }
      }
    }

    // 5. Collections
    const collSheets = ['Daily collection', 'Manager collection', 'recovery collection', 'online collection(nikku ji)'];
    for (const cSheetName of collSheets) {
      if (!workbook.SheetNames.includes(cSheetName)) continue;
      const sheet = workbook.Sheets[cSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const name = row[0];
        const amount = parseFloat(row[1] || row[2]);

        if (name && typeof name === 'string' && !isNaN(amount) && amount > 0) {
          const custId = await getOrRegisterCustomer(name, null);
          if (custId) {
            try {
              await client.query(`
                INSERT INTO collections (customer_id, amount, collection_date, status)
                VALUES ($1, $2, CURRENT_DATE, 'collected');
              `, [custId, amount]);
              totalCollections++;
            } catch {}
          }
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 IMPORT COMPLETED IN ${elapsed} SECONDS!`);
    console.log(`- Total Unique Customers in Database: ${customerMap.size}`);
    console.log(`- Total Bissi Tokens Issued: ${totalTokens}`);
    console.log(`- Total Loan Records: ${totalLoans}`);
    console.log(`- Total Collections Recorded: ${totalCollections}`);

  } finally {
    client.release();
    await pool.end();
  }
}

fastImport().catch(err => {
  console.error('Import error:', err);
  process.exit(1);
});
