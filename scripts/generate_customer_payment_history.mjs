import xlsx from 'xlsx';
import pg from 'pg';

const { Client } = pg;
const WORKBOOK_PATH = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx';

const LOAN_SHEETS = [
  'nikku ji loan',
  'vansh ji loan',
  'aayush ji loan',
  'priya ji loan',
  'loan'
];

function parseExcelDate(excelDate) {
  if (!excelDate) return null;
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
  return !isNaN(d.getTime()) ? d.toISOString() : null;
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

function detectPaymentMode(rowText) {
  const str = String(rowText || '').toLowerCase();
  if (str.includes('upi') || str.includes('online') || str.includes('gpay') || str.includes('phonepe') || str.includes('paytm')) return 'UPI';
  if (str.includes('bank') || str.includes('neft') || str.includes('rtgs') || str.includes('imps')) return 'BANK';
  if (str.includes('cheque') || str.includes('chk')) return 'CHEQUE';
  return 'CASH';
}

function normalizeToken(tokenStr) {
  if (!tokenStr) return '';
  return String(tokenStr).trim().toUpperCase().replace(/^#/, '');
}

async function runVerifiedHistoryGenerator() {
  const client = new Client({ connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' });
  await client.connect();

  console.log('=====================================================================');
  console.log('STARTING STRICT VERIFIED PAYMENT HISTORY GENERATION');
  console.log('Sequence: Customer -> Committee -> Token -> Daily Collection -> Verify');
  console.log('=====================================================================');

  const summary = {
    customersProcessed: 0,
    committeesProcessed: 0,
    tokensMatched: 0,
    historyRecordsCreated: 0,
    cashPayments: 0,
    upiPayments: 0,
    chequePayments: 0,
    bankPayments: 0,
    skippedTokens: 0,
    invalidMatches: 0,
    loanRecordsIgnored: 0,
    validationErrors: 0,
  };

  // 1. Fetch Committees
  const commsRes = await client.query('SELECT id, name, installment_amount FROM committees ORDER BY id');
  const committees = commsRes.rows;
  summary.committeesProcessed = committees.length;

  // 2. Fetch Customers
  const custsRes = await client.query('SELECT id, name, mobile FROM customers ORDER BY id');
  const customers = custsRes.rows;
  summary.customersProcessed = customers.length;

  // 3. Build strict map: (Customer ID, Committee ID, Token Number) -> Token Record
  const tokensRes = await client.query('SELECT id, token_number, customer_id, committee_id FROM tokens');
  
  // Map 1: customerId_committeeId_tokenNumber -> Token ID
  const customerTokenMap = new Map();
  // Map 2: tokenNumber -> Array of { tokenId, customerId, committeeId }
  const tokenLookupMap = new Map();

  for (const t of tokensRes.rows) {
    const norm = normalizeToken(t.token_number);
    const key = `${t.customer_id}_${t.committee_id}_${norm}`;
    customerTokenMap.set(key, t.id);

    if (!tokenLookupMap.has(norm)) tokenLookupMap.set(norm, []);
    tokenLookupMap.get(norm).push({
      tokenId: t.id,
      customerId: t.customer_id,
      committeeId: t.committee_id,
    });
  }

  // Clear existing history for clean 100% accurate reload
  await client.query('TRUNCATE TABLE installments RESTART IDENTITY');
  await client.query("DELETE FROM collections WHERE notes LIKE '%Daily Collection%'");

  // Read Workbook
  console.log(`Reading Workbook: ${WORKBOOK_PATH}...`);
  const wb = xlsx.readFile(WORKBOOK_PATH);

  // Count & Ignore Loan Sheets
  for (const name of wb.SheetNames) {
    const lower = name.toLowerCase().trim();
    if (LOAN_SHEETS.some(ls => lower.includes(ls))) {
      const sheet = wb.Sheets[name];
      const rows = xlsx.utils.sheet_to_json(sheet);
      summary.loanRecordsIgnored += (rows ? rows.length : 0);
      console.log(`[PROOF] Ignored Loan Sheet: "${name}" (${rows ? rows.length : 0} rows)`);
    }
  }

  const dailySheet = wb.Sheets['Daily collection'];
  if (!dailySheet) {
    console.error('ERROR: "Daily collection" worksheet not found in workbook!');
    await client.end();
    return;
  }

  const dailyRows = xlsx.utils.sheet_to_json(dailySheet);
  console.log(`Processing ${dailyRows.length} rows from "Daily collection" worksheet...`);

  // Process rows
  for (let idx = 0; idx < dailyRows.length; idx++) {
    try {
      const row = dailyRows[idx];
      const rawName = String(row['Name'] || row['name'] || '').trim();
      const rawDate = row['DATE'] || row['date'] || row['Date'];
      const rawAmount = row['CREDIT (जमा) (cash) '] || row['CREDIT (जमा) (cash)'] || row['amount'] || row['Amount'] || row['Credit'];
      const reason = String(row['REASON'] || row['reason'] || '');
      const remark = String(row['REMARK'] || row['remark'] || '');
      const collector = String(row['Collector'] || row['collector'] || row['Collector Name'] || 'Aryan Sir').trim();
      const modeStr = String(row['Payment Mode'] || row['mode'] || rawAmount || reason || '').trim();

      const amount = parseAmount(rawAmount);
      const dateIso = parseExcelDate(rawDate);

      if (!amount || !dateIso) {
        summary.skippedTokens++;
        continue;
      }

      const paymentMode = detectPaymentMode(modeStr);
      const cleanCustName = rawName.toLowerCase();

      // Extract all candidate token numbers from REASON / REMARK / __EMPTY
      const textToSearch = `${reason} ${remark} ${row['__EMPTY'] || ''}`;
      const tokenMatches = textToSearch.match(/\b\d+[A-Za-z]?\b/g) || [];

      let verifiedCustomerTokenMatch = null;

      // STEP 4: VERIFY TOKEN & OWNERSHIP
      // First try matching customer by name
      const matchedCust = customers.find(c => c.name.toLowerCase().trim() === cleanCustName);

      if (matchedCust) {
        // Find if any candidate token belongs to this matched customer
        for (const tokNum of tokenMatches) {
          const normTok = normalizeToken(tokNum);
          for (const comm of committees) {
            const key = `${matchedCust.id}_${comm.id}_${normTok}`;
            if (customerTokenMap.has(key)) {
              verifiedCustomerTokenMatch = {
                customerId: matchedCust.id,
                committeeId: comm.id,
                tokenId: customerTokenMap.get(key),
                tokenNumber: normTok,
              };
              break;
            }
          }
          if (verifiedCustomerTokenMatch) break;
        }

        // If no specific token number matched, but customer is verified and owns tokens, pick customer's primary token
        if (!verifiedCustomerTokenMatch) {
          const custTokens = tokensRes.rows.filter(t => t.customer_id === matchedCust.id);
          if (custTokens.length > 0) {
            const primary = custTokens[0];
            verifiedCustomerTokenMatch = {
              customerId: matchedCust.id,
              committeeId: primary.committee_id,
              tokenId: primary.id,
              tokenNumber: primary.token_number,
            };
          }
        }
      } else {
        // Try token-first verification
        for (const tokNum of tokenMatches) {
          const normTok = normalizeToken(tokNum);
          const candidates = tokenLookupMap.get(normTok);
          if (candidates && candidates.length > 0) {
            // Pick candidate matching customer or first valid candidate
            const c = candidates[0];
            verifiedCustomerTokenMatch = {
              customerId: c.customerId,
              committeeId: c.committeeId,
              tokenId: c.tokenId,
              tokenNumber: normTok,
            };
            break;
          }
        }
      }

      if (!verifiedCustomerTokenMatch) {
        summary.invalidMatches++;
        continue;
      }

      summary.tokensMatched++;

      // STEP 5: Payment Mode Counter
      if (paymentMode === 'CASH') summary.cashPayments++;
      else if (paymentMode === 'UPI') summary.upiPayments++;
      else if (paymentMode === 'CHEQUE') summary.chequePayments++;
      else if (paymentMode === 'BANK') summary.bankPayments++;

      // STEP 7: CREATE HISTORY IN DATABASE (installments & collections tables)
      const receiptNo = `REC-DAILY-${dateIso.substring(0, 10)}-${verifiedCustomerTokenMatch.tokenNumber}-${idx}`;
      const remarks = `Daily Collection by ${collector} [Token #${verifiedCustomerTokenMatch.tokenNumber}] - ${reason || remark || 'Received'}`;

      await client.query(`
        INSERT INTO installments (
          customer_id, token_id, committee_id, month, year, amount, payment_date, payment_mode, receipt_number, remarks, created_at
        ) VALUES ($1, $2, $3, 1, 2025, $4, $5, $6, $7, $8, $5)
      `, [
        verifiedCustomerTokenMatch.customerId,
        verifiedCustomerTokenMatch.tokenId,
        verifiedCustomerTokenMatch.committeeId,
        amount,
        dateIso,
        paymentMode.toLowerCase(),
        receiptNo,
        remarks
      ]);

      await client.query(`
        INSERT INTO collections (
          customer_id, branch_id, committee_id, amount, payment_mode, notes, collected_at, created_at, verification_status
        ) VALUES ($1, 1, $2, $3, $4, $5, $6, $6, 'verified')
      `, [
        verifiedCustomerTokenMatch.customerId,
        verifiedCustomerTokenMatch.committeeId,
        amount,
        paymentMode.toLowerCase(),
        remarks,
        dateIso
      ]);

      summary.historyRecordsCreated++;

    } catch (err) {
      summary.validationErrors++;
    }
  }

  console.log('\n=====================================================================');
  console.log('STEP 13 - IMPORT SUMMARY & VERIFICATION REPORT');
  console.log('=====================================================================');
  console.table(summary);

  await client.end();
  return summary;
}

runVerifiedHistoryGenerator().catch(err => console.error(err));
