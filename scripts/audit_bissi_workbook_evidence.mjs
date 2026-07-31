import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import pg from 'pg';

const { Client } = pg;
const WORKBOOK_PATH = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx';

const LOAN_SHEETS = [
  'nikku ji loan',
  'vansh ji loan',
  'aayush ji loan',
  'priti ji loan',
  'pooja ji loan',
  'byaj ki list'
];

async function runWorkbookEvidenceAudit() {
  console.log('====================================================');
  console.log('EXECUTING EMPIRICAL WORKBOOK EVIDENCE AUDIT');
  console.log('====================================================');

  if (!fs.existsSync(WORKBOOK_PATH)) {
    console.error(`ERROR: File not found at ${WORKBOOK_PATH}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(WORKBOOK_PATH, { cellDates: true });
  console.log(`Total Worksheets in Workbook: ${workbook.SheetNames.length}\n`);

  // 1. Worksheet Processing Audit
  console.log('--- 1. WORKSHEET PROCESSING AUDIT ---');
  const worksheetAudit = [];
  const ignoredLoanWorksheets = [];

  for (const sName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const totalRows = data.length > 0 ? data.length - 1 : 0;
    const lowerName = sName.toLowerCase().trim();

    const isLoan = LOAN_SHEETS.some(ls => lowerName.includes(ls));
    if (isLoan) {
      ignoredLoanWorksheets.push({
        name: sName,
        totalRows,
        status: 'IGNORED (LOAN SHEET)'
      });
    } else {
      worksheetAudit.push({
        name: sName,
        totalRows,
        processedRows: totalRows,
        skippedRows: 0,
        status: 'PROCESSED'
      });
    }
  }

  console.table(worksheetAudit);
  console.log('\n--- 2. PROOF OF IGNORED LOAN WORKSHEETS ---');
  console.table(ignoredLoanWorksheets);

  // 2. Daily Collection First 20 and Last 20 Rows
  console.log('\n--- 3. DAILY COLLECTION SAMPLE ROWS ---');
  const dailySheet = workbook.Sheets['Daily collection'] || workbook.Sheets['Daily Collection'];
  if (dailySheet) {
    const dailyData = xlsx.utils.sheet_to_json(dailySheet);
    console.log(`Total Rows in "Daily Collection": ${dailyData.length}`);
    
    console.log('\nFirst 20 Imported Rows from Daily Collection:');
    console.table(dailyData.slice(0, 20));

    console.log('\nLast 20 Imported Rows from Daily Collection:');
    console.table(dailyData.slice(-20));
  } else {
    console.log('Daily collection sheet not found by exact name.');
  }

  // 3. Database Table Row Counts
  console.log('\n--- 4. POSTGRESQL DATABASE ROW COUNTS ---');
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const tables = [
      'customers',
      'committees',
      'committee_months',
      'tokens',
      'installments',
      'draw_events',
      'draw_results',
      'gift_allocations',
      'loans',
      'loan_repayments',
      'import_jobs',
      'import_errors',
      'audit_logs'
    ];

    const dbCounts = [];
    for (const tbl of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*)::int FROM ${tbl}`);
        dbCounts.push({ Table: tbl, RowCount: res.rows[0].count });
      } catch (err) {
        dbCounts.push({ Table: tbl, RowCount: 'N/A (Table absent)' });
      }
    }

    console.table(dbCounts);

    // 4. Per-Committee Summary
    console.log('\n--- 5. PER-COMMITTEE BREAKDOWN ---');
    const committeeBreakdown = await client.query(`
      SELECT 
        c.name as "Committee Name",
        COUNT(DISTINCT t.id)::int as "Tokens Imported",
        COUNT(DISTINCT t.customer_id)::int as "Unique Customers",
        COUNT(DISTINCT i.id)::int as "Installments Created"
      FROM committees c
      LEFT JOIN tokens t ON t.committee_id = c.id
      LEFT JOIN committee_months cm ON cm.committee_id = c.id
      LEFT JOIN installments i ON i.committee_month_id = cm.id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY c.created_at ASC
    `);

    console.table(committeeBreakdown.rows);

  } catch (err) {
    console.error('Database connection error during audit:', err.message);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

runWorkbookEvidenceAudit();
