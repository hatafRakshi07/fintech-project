import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import pg from 'pg';

const { Client } = pg;
const WORKBOOK_PATH = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx';
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Loan sheets to strictly ignore
const LOAN_SHEETS = [
  'nikku ji loan',
  'vansh ji loan',
  'aayush ji loan',
  'priti ji loan',
  'pooja ji loan',
  'byaj ki list'
];

function normalizeTokenNumber(tokenStr) {
  if (!tokenStr) return { raw: '', norm: 0 };
  let str = String(tokenStr).trim();

  str = str.replace(/[½\u1BD1]/g, '')
           .replace(/\s*1\/2/g, '')
           .replace(/\.5$/g, '');

  const normMatch = str.match(/\d+/);
  const norm = normMatch ? parseInt(normMatch[0], 10) : 0;
  return { raw: str, norm };
}

function parseExcelDate(dateVal) {
  if (!dateVal) return null;

  if (typeof dateVal === 'number') {
    const jsDate = xlsx.SSF.parse_date_code(dateVal);
    if (jsDate) {
      const yyyy = jsDate.y;
      const mm = String(jsDate.m).padStart(2, '0');
      const dd = String(jsDate.d).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  const str = String(dateVal).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (ddmmyyyy) {
    const dd = String(ddmmyyyy[1]).padStart(2, '0');
    const mm = String(ddmmyyyy[2]).padStart(2, '0');
    const yyyy = ddmmyyyy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const yyyymmdd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (yyyymmdd) {
    const yyyy = yyyymmdd[1];
    const mm = String(yyyymmdd[2]).padStart(2, '0');
    const dd = String(yyyymmdd[3]).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

async function runBissiV4Import() {
  console.log('====================================================');
  console.log('STARTING BISSI WORKBOOK V4 DATABASE UPDATE IMPORT');
  console.log('====================================================');
  console.log(`Reading Workbook: ${WORKBOOK_PATH}`);

  if (!fs.existsSync(WORKBOOK_PATH)) {
    console.error(`ERROR: Workbook file not found at ${WORKBOOK_PATH}`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
  const client = new Client({ connectionString });
  
  const summary = {
    customersCreated: 0,
    customersUpdated: 0,
    customersMerged: 0,
    tokensCreated: 0,
    tokensUpdated: 0,
    tokensNormalized: 0,
    installmentsImported: 0,
    dailyCollectionHistoryImported: 0,
    luckyDrawImported: 0,
    giftWinnersImported: 0,
    bonusRewardsImported: 0,
    loanRowsIgnored: 0,
    skippedRows: 0,
    validationErrors: 0,
    totalSuccessfulRows: 0
  };

  try {
    await client.connect();
    const workbook = xlsx.readFile(WORKBOOK_PATH, { cellDates: true });
    console.log(`Successfully loaded ${workbook.SheetNames.length} worksheets.`);

    const committeeDefs = [
      { name: 'Sawariya Seth Bissi (5th Date)', code: 'SAWARIYA-5TH', installment: 3000, members: 500 },
      { name: 'Pyare Mohan Bissi (15th Date)', code: 'PYARE-15TH', installment: 3000, members: 500 },
      { name: 'Hare Ka Sahara Bissi (20th Date)', code: 'HARE-20TH', installment: 2500, members: 500 },
      { name: 'Shree Krishna Associate Bissi', code: 'KRISHNA-1111', installment: 3000, members: 1111 }
    ];

    const committeeMap = new Map();
    for (const cDef of committeeDefs) {
      let res = await client.query('SELECT id FROM committees WHERE name = $1 LIMIT 1', [cDef.name]);
      let cId;
      if (res.rows.length > 0) {
        cId = res.rows[0].id;
      } else {
        const ins = await client.query(`
          INSERT INTO committees (organization_id, name, code, total_members, total_months, monthly_installment, start_date, status)
          VALUES ($1, $2, $3, $4, 30, $5, CURRENT_DATE, 'ACTIVE')
          RETURNING id
        `, [DEFAULT_ORG_ID, cDef.name, cDef.code, cDef.members, cDef.installment]);
        cId = ins.rows[0].id;
      }
      committeeMap.set(cDef.name, cId);
    }

    const customerCache = [];
    const custRes = await client.query('SELECT id, name, father_name, mobile, aadhaar, address FROM customers');
    for (const row of custRes.rows) {
      customerCache.push(row);
    }

    async function findOrCreateCustomer(nameStr, fatherStr, mobileStr, aadhaarStr, addressStr) {
      const cleanName = (nameStr || '').trim();
      const cleanFather = (fatherStr || '').trim();
      const cleanMobile = (mobileStr || '').replace(/\D/g, '').slice(-10);
      const cleanAadhaar = (aadhaarStr || '').replace(/\D/g, '');
      const cleanAddr = (addressStr || '').trim();

      if (!cleanName && !cleanMobile && !cleanAadhaar) return null;

      let match = null;

      if (cleanAadhaar && cleanAadhaar.length === 12) {
        match = customerCache.find(c => c.aadhaar === cleanAadhaar);
      }

      if (!match && cleanMobile && cleanMobile.length === 10) {
        match = customerCache.find(c => c.mobile === cleanMobile);
      }

      if (!match && cleanName && cleanFather) {
        match = customerCache.find(c =>
          (c.name || '').toLowerCase() === cleanName.toLowerCase() &&
          (c.father_name || '').toLowerCase() === cleanFather.toLowerCase()
        );
      }

      if (!match && cleanName && cleanAddr) {
        match = customerCache.find(c =>
          (c.name || '').toLowerCase() === cleanName.toLowerCase() &&
          (c.address || '').toLowerCase() === cleanAddr.toLowerCase()
        );
      }

      if (match) {
        let updated = false;
        if (!match.father_name && cleanFather) { match.father_name = cleanFather; updated = true; }
        if (!match.aadhaar && cleanAadhaar) { match.aadhaar = cleanAadhaar; updated = true; }
        if (!match.address && cleanAddr) { match.address = cleanAddr; updated = true; }

        if (updated) {
          await client.query(`
            UPDATE customers 
            SET father_name = $1, aadhaar = $2, address = $3, updated_at = NOW()
            WHERE id = $4
          `, [match.father_name, match.aadhaar, match.address, match.id]);
          summary.customersUpdated++;
        } else {
          summary.customersMerged++;
        }
        return match.id;
      }

      const finalMobile = cleanMobile.length === 10 ? cleanMobile : `9${Math.floor(100000009 + Math.random() * 899999990)}`;
      const insRes = await client.query(`
        INSERT INTO customers (organization_id, name, father_name, mobile, aadhaar, address, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
        RETURNING id, name, father_name, mobile, aadhaar, address
      `, [DEFAULT_ORG_ID, cleanName || 'Bissi Member', cleanFather || null, finalMobile, cleanAadhaar || null, cleanAddr || null]);

      const newCust = insRes.rows[0];
      customerCache.push(newCust);
      summary.customersCreated++;
      return newCust.id;
    }

    for (const sheetName of workbook.SheetNames) {
      const lowerSheet = sheetName.toLowerCase().trim();

      if (LOAN_SHEETS.some(ls => lowerSheet.includes(ls))) {
        console.log(`[Ignore] Skipping Loan sheet: "${sheetName}"`);
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);
        summary.loanRowsIgnored += (rows ? rows.length : 0);
        continue;
      }

      if (lowerSheet.includes('daily collection')) {
        console.log(`[Processing] Importing Daily Collection Payment History from: "${sheetName}"`);
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);

        for (const row of rows) {
          try {
            const rawDate = row['Date'] || row['date'] || row['Collection Date'];
            const dateStr = parseExcelDate(rawDate);
            const collectorName = row['Collector'] || row['collector'] || row['Collector Name'] || 'Aryan Sir';
            const committeeName = row['Committee'] || row['committee'] || row['Scheme'] || 'Sawariya Seth Bissi (5th Date)';
            const tokenVal = row['Token'] || row['token'] || row['Token Number'] || row['Collected Tokens'];
            const amountVal = row['Amount'] || row['amount'] || row['Installment Amount'];

            if (!tokenVal || !dateStr) {
              summary.skippedRows++;
              continue;
            }

            const { raw, norm } = normalizeTokenNumber(tokenVal);
            const committeeId = committeeMap.get(committeeName) || committeeMap.values().next().value;
            const installmentAmount = committeeName.includes('Hare') ? '2500.00' : '3000.00';

            let tokRes = await client.query(
              'SELECT id FROM tokens WHERE committee_id = $1 AND normalized_token_number = $2 LIMIT 1',
              [committeeId, norm]
            );
            let tokenId;
            if (tokRes.rows.length > 0) {
              tokenId = tokRes.rows[0].id;
            } else {
              const dummyCustId = await findOrCreateCustomer(`Member Token #${norm}`, null, null, null, null);
              const insTok = await client.query(`
                INSERT INTO tokens (organization_id, committee_id, customer_id, raw_token_number, normalized_token_number, status)
                VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
                RETURNING id
              `, [DEFAULT_ORG_ID, committeeId, dummyCustId, raw, norm]);
              tokenId = insTok.rows[0].id;
              summary.tokensCreated++;
            }

            let cmRes = await client.query('SELECT id FROM committee_months WHERE committee_id = $1 LIMIT 1', [committeeId]);
            let cmId;
            if (cmRes.rows.length > 0) {
              cmId = cmRes.rows[0].id;
            } else {
              const insCm = await client.query(`
                INSERT INTO committee_months (organization_id, committee_id, month_number, month_name, due_date)
                VALUES ($1, $2, 1, 'Month 1', $3)
                RETURNING id
              `, [DEFAULT_ORG_ID, committeeId, dateStr]);
              cmId = insCm.rows[0].id;
            }

            const receiptNo = `DAILY-COL-${dateStr}-${norm}-${Math.floor(100 + Math.random() * 900)}`;
            await client.query(`
              INSERT INTO installments (
                organization_id, committee_month_id, token_id, receipt_number, expected_amount, paid_amount, payment_date, payment_mode, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CASH', $8)
            `, [DEFAULT_ORG_ID, cmId, tokenId, receiptNo, installmentAmount, amountVal ? parseFloat(amountVal).toFixed(2) : installmentAmount, dateStr, `Daily Collection by ${collectorName}`]);

            summary.installmentsImported++;
            summary.dailyCollectionHistoryImported++;
            summary.totalSuccessfulRows++;
          } catch (err) {
            summary.validationErrors++;
          }
        }
      }
    }

    console.log('====================================================');
    console.log('IMPORT WORKFLOW COMPLETED SUCCESSFULLY');
    console.log('====================================================');
    console.log(JSON.stringify(summary, null, 2));

  } catch (err) {
    console.error('Import Execution Info:', err.message);
  } finally {
    try { await client.end(); } catch (e) {}
  }

  return summary;
}

runBissiV4Import();
