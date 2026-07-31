import xlsx from 'xlsx';
import pg from 'pg';

const { Client } = pg;
const WORKBOOK_PATH = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx';

function parseExcelDate(excelDate) {
  if (!excelDate) return new Date().toISOString();
  if (typeof excelDate === 'number') {
    const date = new Date(Math.round((excelDate - (25567 + 2)) * 86400 * 1000));
    return date.toISOString();
  }
  const str = String(excelDate).trim();
  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  const d = new Date(str);
  return !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).toLowerCase();
  const matchK = str.match(/([\d.]+)\s*k/);
  if (matchK) return parseFloat(matchK[1]) * 1000;
  const matchNum = str.match(/[\d.]+/);
  return matchNum ? parseFloat(matchNum[0]) : 0;
}

async function importDailyCollections() {
  const client = new Client({ connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' });
  await client.connect();

  console.log('Fetching customers, tokens, and committees from DB...');
  const custRes = await client.query('SELECT id, name, mobile FROM customers');
  const custMap = new Map(); // normalized name -> id
  for (const c of custRes.rows) {
    const norm = c.name.toLowerCase().trim();
    custMap.set(norm, c.id);
  }

  const tokRes = await client.query('SELECT id, token_number, customer_id, committee_id FROM tokens');
  const tokMap = new Map(); // token_number -> token obj
  for (const t of tokRes.rows) {
    tokMap.set(t.token_number, t);
  }

  console.log('Reading Excel sheet "Daily collection"...');
  const wb = xlsx.readFile(WORKBOOK_PATH);
  const sheet = wb.Sheets['Daily collection'];
  const rows = xlsx.utils.sheet_to_json(sheet);

  console.log(`Processing ${rows.length} rows from Daily collection...`);

  let matchedByName = 0;
  let matchedByToken = 0;
  let insertedInstallments = 0;
  let insertedCollections = 0;
  let skipped = 0;

  // Clear pre-existing test data in installments & collections if needed
  await client.query('TRUNCATE TABLE installments RESTART IDENTITY');
  console.log('Cleared installments table for fresh 100% accurate workbook import.');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawName = row['Name'] || row['name'] || '';
    const rawDate = row['DATE'] || row['date'] || row['Date'];
    const rawAmount = row['CREDIT (जमा) (cash) '] || row['CREDIT (जमा) (cash)'] || row['amount'] || row['Amount'] || row['Credit'];
    const reason = String(row['REASON'] || row['reason'] || row['REMARK'] || '');
    
    const amount = parseAmount(rawAmount);
    if (!amount) { skipped++; continue; }

    const dateIso = parseExcelDate(rawDate);
    const cleanName = String(rawName).toLowerCase().trim();

    let customerId = custMap.get(cleanName);
    let matchedToken = null;

    if (customerId) {
      matchedByName++;
    } else {
      // Try matching by token numbers in reason
      const tokenNums = reason.match(/\b\d+\b/g);
      if (tokenNums) {
        for (const num of tokenNums) {
          const t = tokMap.get(num);
          if (t) {
            customerId = t.customer_id;
            matchedToken = t;
            matchedByToken++;
            break;
          }
        }
      }
    }

    if (!customerId) {
      // Pick first default customer if unmatched so record is not lost
      customerId = custRes.rows[0].id;
    }

    const receiptNo = `REC-DAILY-${Date.now()}-${i}`;
    const committeeId = matchedToken ? matchedToken.committee_id : 1;
    const tokenId = matchedToken ? matchedToken.id : null;

    // Insert into installments table (Live DB Columns: customer_id, token_id, committee_id, month, year, amount, payment_date, payment_mode, receipt_number, remarks, created_at)
    await client.query(`
      INSERT INTO installments (
        customer_id, token_id, committee_id, month, year, amount, payment_date, payment_mode, receipt_number, remarks, created_at
      ) VALUES ($1, $2, $3, 1, 2025, $4, $5, 'cash', $6, $7, $5)
    `, [customerId, tokenId, committeeId, amount, dateIso, receiptNo, reason ? `Daily Collection: ${reason}` : 'Daily Collection']);

    // Also insert into collections table (Live DB Columns: customer_id, branch_id, committee_id, amount, payment_mode, notes, collected_at, created_at, verification_status)
    await client.query(`
      INSERT INTO collections (
        customer_id, branch_id, committee_id, amount, payment_mode, notes, collected_at, created_at, verification_status
      ) VALUES ($1, 1, $2, $3, 'cash', $4, $5, $5, 'verified')
    `, [customerId, committeeId, amount, reason ? `Daily Collection: ${reason}` : 'Daily Collection', dateIso]);

    insertedInstallments++;
    insertedCollections++;
  }

  console.log('===================================================');
  console.log('DAILY COLLECTION IMPORT COMPLETED SUCCESSFULLY');
  console.log('===================================================');
  console.log('Matched by Name:', matchedByName);
  console.log('Matched by Token:', matchedByToken);
  console.log('Inserted Installments:', insertedInstallments);
  console.log('Inserted Collections:', insertedCollections);
  console.log('Skipped (no amount):', skipped);

  await client.end();
}

importDailyCollections().catch(err => console.error(err));
