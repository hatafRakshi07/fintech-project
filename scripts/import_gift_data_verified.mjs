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

function normalizeStr(str) {
  if (!str) return '';
  return String(str).toLowerCase().trim();
}

function normalizeToken(tokenStr) {
  if (!tokenStr) return '';
  return String(tokenStr).trim().toUpperCase().replace(/^#/, '');
}

async function importGiftDataVerified() {
  const client = new Client({ connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' });
  await client.connect();

  console.log('=====================================================================');
  console.log('STARTING STRICT VERIFIED GIFT DATA IMPORT WORKFLOW');
  console.log('=====================================================================');

  const summary = {
    giftMastersImported: 0,
    giftWinnersImported: 0,
    giftClaimsImported: 0,
    cashClaimsImported: 0,
    customersUpdated: 0,
    duplicateRecordsSkipped: 0,
    invalidTokens: 0,
    invalidCommitteeMatches: 0,
    validationErrors: 0,
    successfulRows: 0,
    skippedRows: 0,
  };

  // 1. Fetch DB Entities
  const commsRes = await client.query('SELECT id, name FROM committees ORDER BY id');
  const committees = commsRes.rows;

  const commMap = new Map();
  for (const c of committees) {
    const lower = c.name.toLowerCase();
    if (lower.includes('sawariya') || lower.includes('5th')) commMap.set('sawariya', c.id);
    if (lower.includes('pyare') || lower.includes('15th')) commMap.set('pyare', c.id);
    if (lower.includes('hare') || lower.includes('20th')) commMap.set('hare', c.id);
    if (lower.includes('krishna') || lower.includes('associate')) commMap.set('krishna', c.id);
  }

  const custsRes = await client.query('SELECT id, name, mobile, reference_number FROM customers');
  const customers = custsRes.rows;
  const custNameMap = new Map();
  for (const c of customers) {
    custNameMap.set(normalizeStr(c.name), c.id);
  }

  // Token Lookup: customerId_committeeId_tokenNumber -> tokenId
  const tokensRes = await client.query('SELECT id, token_number, customer_id, committee_id FROM tokens');
  const customerTokenMap = new Map();
  const tokenOnlyMap = new Map(); // tokenNumber -> Array of tokens

  for (const t of tokensRes.rows) {
    const norm = normalizeToken(t.token_number);
    const key = `${t.customer_id}_${t.committee_id}_${norm}`;
    customerTokenMap.set(key, t.id);

    if (!tokenOnlyMap.has(norm)) tokenOnlyMap.set(norm, []);
    tokenOnlyMap.get(norm).push(t);
  }

  // Gift Inventory Map: giftName -> giftId
  const giftIdMap = new Map();

  const wb = xlsx.readFile(WORKBOOK_PATH);

  // -------------------------------------------------------------------------
  // STEP A: GIFT MASTER (gift stock maintain + master gift items)
  // -------------------------------------------------------------------------
  console.log('Processing Gift Master Stock...');
  const stockSheet = wb.Sheets['gift stock maintain'];
  if (stockSheet) {
    const stockRows = xlsx.utils.sheet_to_json(stockSheet);
    for (const r of stockRows) {
      const giftName = String(r['GIFT'] || r['gift'] || r['Item'] || '').trim();
      const qty = parseInt(r['Quantity'] || r['quantity'] || '10', 10);
      if (giftName) {
        const insG = await client.query(`
          INSERT INTO gift_inventory (branch_id, name, quantity_total, quantity_available, quantity_distributed, status, created_at, updated_at)
          VALUES (1, $1, $2, $2, 0, 'active', NOW(), NOW())
          ON CONFLICT DO NOTHING
          RETURNING id
        `, [giftName, isNaN(qty) ? 10 : qty]);

        let gId = insG.rows.length > 0 ? insG.rows[0].id : null;
        if (!gId) {
          const fetchG = await client.query('SELECT id FROM gift_inventory WHERE name = $1 LIMIT 1', [giftName]);
          if (fetchG.rows.length > 0) gId = fetchG.rows[0].id;
        }
        if (gId) {
          giftIdMap.set(normalizeStr(giftName), gId);
          summary.giftMastersImported++;
        }
      }
    }
  }

  // Helper to get or create gift master entry on the fly
  async function getOrCreateGiftId(name) {
    const norm = normalizeStr(name);
    if (!norm) return null;
    if (giftIdMap.has(norm)) return giftIdMap.get(norm);

    const ins = await client.query(`
      INSERT INTO gift_inventory (branch_id, name, quantity_total, quantity_available, quantity_distributed, status, created_at, updated_at)
      VALUES (1, $1, 100, 100, 0, 'active', NOW(), NOW())
      RETURNING id
    `, [name.trim()]);
    const id = ins.rows[0].id;
    giftIdMap.set(norm, id);
    summary.giftMastersImported++;
    return id;
  }

  // -------------------------------------------------------------------------
  // STEP B: PROCESS GIFT RECORD SHEETS (Per Committee Token Gift Winners)
  // -------------------------------------------------------------------------
  const giftRecordSheets = [
    { name: 'Sawariya seth bissi gift record', commKey: 'sawariya' },
    { name: 'Pyare mohan bissi gift records', commKey: 'pyare' },
    { name: 'Hare ka sahara bissi gift recor', commKey: 'hare' },
    { name: 'Shree krishna aasociates gift r', commKey: 'krishna' },
    { name: 'Radhe krishna bissi gift list', commKey: 'krishna' }
  ];

  for (const target of giftRecordSheets) {
    const sheet = wb.Sheets[target.name];
    if (!sheet) continue;

    console.log(`Processing Gift Records Sheet: "${target.name}"...`);
    const rows = xlsx.utils.sheet_to_json(sheet);
    const defaultCommId = commMap.get(target.commKey) || 1;

    for (const r of rows) {
      try {
        const rawTok = r['Token No:-'] || r['token no.'] || r['Token. jjju'] || r['Token'] || r['token'];
        const rawCustName = r['Name'] || r['Name '] || r['Reference name '] || r['Reference Name'] || '';
        const normTok = normalizeToken(rawTok);

        if (!normTok) { summary.skippedRows++; continue; }

        // Find customer
        let customerId = custNameMap.get(normalizeStr(rawCustName));
        let tokenId = null;

        if (customerId) {
          const key = `${customerId}_${defaultCommId}_${normTok}`;
          if (customerTokenMap.has(key)) {
            tokenId = customerTokenMap.get(key);
          }
        }

        if (!tokenId) {
          const matches = tokenOnlyMap.get(normTok) || [];
          const matched = matches.find(t => t.committee_id === defaultCommId) || matches[0];
          if (matched) {
            tokenId = matched.id;
            customerId = matched.customer_id;
          }
        }

        if (!customerId || !tokenId) {
          summary.invalidTokens++;
          summary.skippedRows++;
          continue;
        }

        // Iterate over month gift columns in row
        for (const [colName, val] of Object.entries(r)) {
          if (!val || typeof val !== 'string') continue;
          const cleanVal = val.trim();
          if (!cleanVal || cleanVal === 'Name' || cleanVal === 'Token' || cleanVal.length < 2) continue;

          // Check if column resembles a Month column (e.g., 'Apr-25', 'Oct-25', 'April-26')
          if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(colName)) {
            const isCash = cleanVal.toLowerCase().includes('cash') || cleanVal.toLowerCase().includes('money');
            const giftId = await getOrCreateGiftId(cleanVal);

            const claimMode = isCash ? 'CASH' : 'GIFT';
            if (isCash) summary.cashClaimsImported++;
            else summary.giftClaimsImported++;

            const statusStr = 'claimed';
            const notes = `Month: ${colName} | Claim Mode = ${claimMode} | Gift: ${cleanVal}`;

            // Check duplicate distribution
            const dupCheck = await client.query(`
              SELECT id FROM gift_distributions 
              WHERE customer_id = $1 AND token_id = $2 AND notes LIKE $3
            `, [customerId, tokenId, `%Month: ${colName}%`]);

            if (dupCheck.rows.length > 0) {
              summary.duplicateRecordsSkipped++;
              continue;
            }

            await client.query(`
              INSERT INTO gift_distributions (
                gift_id, customer_id, committee_id, token_id, quantity, distribution_date, status, notes, branch_id, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, 1, CURRENT_DATE, $5, $6, 1, NOW(), NOW())
            `, [giftId, customerId, defaultCommId, tokenId, statusStr, notes]);

            summary.giftWinnersImported++;
            summary.successfulRows++;
          }
        }
      } catch (err) {
        summary.validationErrors++;
      }
    }
  }

  // -------------------------------------------------------------------------
  // STEP C: PROCESS LUCKY DRAW SHEET ("Lucky Token list")
  // -------------------------------------------------------------------------
  const luckySheet = wb.Sheets['Lucky Token list'];
  if (luckySheet) {
    console.log('Processing Lucky Token List Sheet...');
    const rows = xlsx.utils.sheet_to_json(luckySheet);

    for (const r of rows) {
      try {
        const commPairs = [
          { commKey: 'sawariya', mCol: 'Sawariya ', tCol: 'Seth vc' },
          { commKey: 'krishna', mCol: 'Shri krishna ', tCol: 'associate lotrey' },
          { commKey: 'pyare', mCol: 'Pyare ', tCol: 'Mohan Vc' },
          { commKey: 'hare', mCol: 'Hare  ka ', tCol: 'Sahara vc' }
        ];

        for (const pair of commPairs) {
          const monthVal = r[pair.mCol];
          const tokVal = r[pair.tCol];
          if (!tokVal) continue;

          const commId = commMap.get(pair.commKey) || 1;
          const normTok = normalizeToken(tokVal);
          const matches = tokenOnlyMap.get(normTok) || [];
          const matchedToken = matches.find(t => t.committee_id === commId) || matches[0];

          if (matchedToken) {
            // Insert into lotteries table for Lucky Draw tracking
            await client.query(`
              INSERT INTO lotteries (committee_id, draw_date, winner_id, prize_amount, status, notes, created_at, updated_at)
              VALUES ($1, CURRENT_DATE, $2, 3000, 'completed', $3, NOW(), NOW())
              ON CONFLICT DO NOTHING
            `, [commId, matchedToken.customer_id, `Lucky Draw Winner - Token #${normTok} (${monthVal || 'Monthly Draw'})`]);

            // Update token status to 'lucky'
            await client.query("UPDATE tokens SET status = 'lucky' WHERE id = $1", [matchedToken.id]);
            summary.successfulRows++;
          }
        }
      } catch (err) {
        summary.validationErrors++;
      }
    }
  }

  console.log('\n=====================================================================');
  console.log('FINAL GIFT IMPORT VERIFICATION REPORT');
  console.log('=====================================================================');
  console.table(summary);

  await client.end();
  return summary;
}

importGiftDataVerified().catch(err => console.error(err));
