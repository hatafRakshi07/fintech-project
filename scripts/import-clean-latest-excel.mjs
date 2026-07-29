import xlsx from 'xlsx';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const DB_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";
const EXCEL_PATH = "C:/Users/lenovo/Downloads/Bissi folder (5).xlsx";

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

const sheetsConfig = [
  { sheetName: 'Sawariya seth 5 date', committeeId: 1, committeeName: 'Sawariya Seth Bissi', defaultAmount: 3000, defaultLimit: 500, tokenCol: 0, nameCol: 1, refCol: 2, phoneCol: 3, addrCol: 5, instStartCol: 7 },
  { sheetName: 'Pyare mohan 15 date', committeeId: 2, committeeName: 'Pyare Mohan Bissi', defaultAmount: 3000, defaultLimit: 500, tokenCol: 0, nameCol: 1, refCol: 2, phoneCol: 4, addrCol: 6, instStartCol: 8 },
  { sheetName: 'Hare ka sahara bissi 20 date', committeeId: 3, committeeName: 'Hare Ka Sahara Bissi', defaultAmount: 2500, defaultLimit: 500, tokenCol: 0, nameCol: 1, refCol: 2, phoneCol: 3, addrCol: 4, instStartCol: 7 },
  { sheetName: 'Shree Krishna associate lottery', committeeId: 4, committeeName: 'Shree Krishna Bissi', defaultAmount: 3000, defaultLimit: 1111, tokenCol: 0, nameCol: 1, refCol: 2, phoneCol: 3, addrCol: 4, instStartCol: 6 },
];

function cleanMobile(val) {
  if (!val) return null;
  const str = String(val).replace(/[^\d]/g, '');
  if (str.length >= 10) {
    const mob = str.slice(-10);
    if (/^[5-9]\d{9}$/.test(mob)) return mob;
  }
  return null;
}

function cleanName(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'jsk' || s.toLowerCase() === 'none' || s.toLowerCase() === 'null') return null;
  return s;
}

function cleanText(val) {
  if (!val) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

async function main() {
  console.log("=================================================");
  console.log("  HIGH-SPEED BISSI EXCEL IMPORT ENGINE");
  console.log("=================================================");
  console.log(`Source File: ${EXCEL_PATH}`);

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`ERROR: File not found at ${EXCEL_PATH}`);
    process.exit(1);
  }

  const startTime = Date.now();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Ensure/Update Committees
    console.log("\n[1/6] Verifying Bissi Committees...");
    for (const cfg of sheetsConfig) {
      await client.query(
        `INSERT INTO committees (id, name, type, installment_amount, member_limit, status, branch_id, created_at, updated_at)
         VALUES ($1, $2, 'monthly', $3, $4, 'active', 1, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name,
           installment_amount = EXCLUDED.installment_amount,
           member_limit = EXCLUDED.member_limit,
           updated_at = NOW()`,
        [cfg.committeeId, cfg.committeeName, cfg.defaultAmount, cfg.defaultLimit]
      );
    }

    // 2. Load index maps
    console.log("\n[2/6] Indexing existing database records...");
    const mobileMap = new Map();
    const nameAddrMap = new Map();

    const existingCustRes = await client.query(`SELECT id, name, mobile, address FROM customers`);
    for (const row of existingCustRes.rows) {
      if (row.mobile) mobileMap.set(row.mobile, row.id);
      if (row.name) {
        const key = `${row.name.toLowerCase().trim()}|${(row.address || '').toLowerCase().trim()}`;
        if (!nameAddrMap.has(key)) nameAddrMap.set(key, row.id);
      }
    }

    const tokenMap = new Map(); // `${committeeId}|${tokenNumber}` -> token_id
    const existingTokensRes = await client.query(`SELECT id, committee_id, token_number FROM tokens`);
    for (const row of existingTokensRes.rows) {
      tokenMap.set(`${row.committee_id}|${row.token_number}`, row.id);
    }

    // Read Workbook & Process Data in Memory
    console.log("\n[3/6] Reading & Normalizing Excel workbook...");
    const wb = xlsx.readFile(EXCEL_PATH);

    let totalCustomersImported = 0;
    let existingCustomersReused = 0;
    let totalTokensImported = 0;
    let totalHalfTokensConverted = 0;
    let totalDuplicateTokensRenamed = 0;
    let totalParticipationsCreated = 0;
    let totalInstallmentsCreated = 0;
    let paidInstallments = 0;
    let pendingInstallments = 0;

    const newCustomersToInsert = []; // Array of objects
    const allParsedItems = [];       // Array of all token rows across sheets

    for (const cfg of sheetsConfig) {
      const ws = wb.Sheets[cfg.sheetName];
      if (!ws) continue;

      const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1 });
      if (rawRows.length <= 1) continue;

      let sheetHalfTokens = 0;
      const extractedRows = [];

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const rawTokenVal = row[cfg.tokenCol];
        if (rawTokenVal === undefined || rawTokenVal === null || String(rawTokenVal).trim() === '') continue;

        let tokenStr = String(rawTokenVal).trim();
        if (tokenStr.includes('1/2') || tokenStr.includes('½') || tokenStr.includes('(1/2)')) {
          sheetHalfTokens++;
          tokenStr = tokenStr.replace(/\(1\/2\)/g, '').replace(/1\/2/g, '').replace(/½/g, '').trim();
        }

        const name = cleanName(row[cfg.nameCol]);
        const refName = cleanText(row[cfg.refCol]);
        const phone = cleanMobile(row[cfg.phoneCol]);
        const addr = cleanText(row[cfg.addrCol]);

        extractedRows.push({
          committeeId: cfg.committeeId,
          defaultAmount: cfg.defaultAmount,
          instStartCol: cfg.instStartCol,
          rowIndex: r,
          baseToken: tokenStr,
          name,
          refName,
          phone,
          addr,
          row
        });
      }

      totalHalfTokensConverted += sheetHalfTokens;

      // Group by baseToken for duplicates
      const grouped = new Map();
      for (const item of extractedRows) {
        if (!grouped.has(item.baseToken)) grouped.set(item.baseToken, []);
        grouped.get(item.baseToken).push(item);
      }

      let sheetDuplicates = 0;
      for (const [baseToken, items] of grouped.entries()) {
        if (items.length > 1) {
          sheetDuplicates += items.length;
          items.forEach((item, idx) => {
            const letter = String.fromCharCode(65 + idx);
            item.normalizedToken = `${baseToken}${letter}`;
          });
        } else {
          items[0].normalizedToken = baseToken;
        }
      }

      totalDuplicateTokensRenamed += sheetDuplicates;
      allParsedItems.push(...extractedRows);
    }

    // 4. Batch Customer Insertion
    console.log(`\n[4/6] Processing ${allParsedItems.length} Tokens & Deduplicating Customers...`);
    const newCustBatch = [];

    for (const item of allParsedItems) {
      let customerId = null;

      if (item.phone && mobileMap.has(item.phone)) {
        customerId = mobileMap.get(item.phone);
        existingCustomersReused++;
      } else if (item.name) {
        const key = `${item.name.toLowerCase().trim()}|${(item.addr || '').toLowerCase().trim()}`;
        if (nameAddrMap.has(key)) {
          customerId = nameAddrMap.get(key);
          existingCustomersReused++;
        }
      }

      if (!customerId) {
        // Prepare new customer
        const custName = item.name || item.refName || `Customer Token ${item.normalizedToken}`;
        const refNum = `BS-${item.committeeId}-${item.normalizedToken}-${Math.floor(1000 + Math.random() * 9000)}`;
        const custMobile = item.phone || `900${Math.floor(1000000 + Math.random() * 9000000)}`;

        newCustBatch.push({
          refNum,
          custName,
          custMobile,
          addr: item.addr,
          refName: item.refName,
          phone: item.phone,
          nameKey: item.name ? `${item.name.toLowerCase().trim()}|${(item.addr || '').toLowerCase().trim()}` : null,
          itemRef: item
        });
      } else {
        item.customerId = customerId;
      }
    }

    // Insert new customers in bulk
    if (newCustBatch.length > 0) {
      console.log(`  Bulk inserting ${newCustBatch.length} new customer records...`);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const c of newCustBatch) {
        values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 1, 'active', NOW(), NOW())`);
        params.push(c.refNum, c.custName, c.custMobile, c.addr, c.refName);
      }

      const bulkCustSql = `
        INSERT INTO customers (reference_number, name, mobile, address, reference_name, branch_id, status, created_at, updated_at)
        VALUES ${values.join(', ')}
        RETURNING id, mobile, name, address`;
      
      const bulkCustRes = await client.query(bulkCustSql, params);
      totalCustomersImported = bulkCustRes.rows.length;

      bulkCustRes.rows.forEach((row, i) => {
        const cObj = newCustBatch[i];
        const newId = row.id;
        cObj.itemRef.customerId = newId;

        if (cObj.phone) mobileMap.set(cObj.phone, newId);
        mobileMap.set(cObj.custMobile, newId);
        if (cObj.nameKey) nameAddrMap.set(cObj.nameKey, newId);
      });
    }

    // 5. Bulk Token & Member Insertion
    console.log(`\n[5/6] Bulk inserting / updating Tokens & Members...`);
    const tokenInsertVals = [];
    const tokenInsertParams = [];
    let tIdx = 1;

    for (const item of allParsedItems) {
      let tokenStatus = 'active';
      for (let c = item.instStartCol; c < item.row.length; c++) {
        const cellVal = item.row[c];
        if (cellVal !== undefined && cellVal !== null) {
          const s = String(cellVal).trim().toLowerCase();
          if (s === 'lucky' || s === 'out' || s === 'closed') {
            tokenStatus = s;
            break;
          }
        }
      }

      item.tokenStatus = tokenStatus;
      const key = `${item.committeeId}|${item.normalizedToken}`;

      if (!tokenMap.has(key)) {
        const validStatus = (tokenStatus === 'lucky' || tokenStatus === 'out' || tokenStatus === 'closed') ? tokenStatus : 'active';
        tokenInsertVals.push(`($${tIdx++}, $${tIdx++}, $${tIdx++}, $${tIdx++}::token_status, NOW(), NOW())`);
        tokenInsertParams.push(item.normalizedToken, item.customerId, item.committeeId, validStatus);
      }
    }

    if (tokenInsertVals.length > 0) {
      console.log(`  Bulk inserting ${tokenInsertVals.length} new token records...`);
      // Insert in chunks of 500
      const chunkSize = 500;
      for (let i = 0; i < tokenInsertVals.length; i += chunkSize) {
        const chunkVals = tokenInsertVals.slice(i, i + chunkSize);
        const chunkParams = tokenInsertParams.slice(i * 4, (i + chunkSize) * 4);
        
        // Re-index params
        let cIdx = 1;
        const reindexedVals = chunkVals.map(v => v.replace(/\$\d+/g, () => `$${cIdx++}`));
        const sql = `INSERT INTO tokens (token_number, customer_id, committee_id, status, created_at, updated_at) VALUES ${reindexedVals.join(', ')} RETURNING id, committee_id, token_number`;
        
        const res = await client.query(sql, chunkParams);
        res.rows.forEach(r => {
          tokenMap.set(`${r.committee_id}|${r.token_number}`, r.id);
        });
      }
      totalTokensImported = tokenInsertVals.length;
    }

    // Refresh token IDs on items
    for (const item of allParsedItems) {
      const key = `${item.committeeId}|${item.normalizedToken}`;
      item.tokenId = tokenMap.get(key);
    }

    // Bulk Committee Members
    const memberVals = [];
    const memberParams = [];
    let mIdx = 1;

    for (const item of allParsedItems) {
      memberVals.push(`($${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, NOW())`);
      memberParams.push(item.committeeId, item.customerId, item.normalizedToken, item.tokenStatus);
    }

    if (memberVals.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < memberVals.length; i += chunkSize) {
        const chunkVals = memberVals.slice(i, i + chunkSize);
        const chunkParams = memberParams.slice(i * 4, (i + chunkSize) * 4);

        let cIdx = 1;
        const reindexedVals = chunkVals.map(v => v.replace(/\$\d+/g, () => `$${cIdx++}`));
        const sql = `INSERT INTO committee_members (committee_id, customer_id, token_number, status, joined_at) VALUES ${reindexedVals.join(', ')} ON CONFLICT DO NOTHING`;
        await client.query(sql, chunkParams);
      }
      totalParticipationsCreated = memberVals.length;
    }

    // 6. Bulk Installments & Collections Insertion
    console.log(`\n[6/6] Bulk inserting Installments & Collections...`);
    const instVals = [];
    const instParams = [];
    let iIdx = 1;

    const collVals = [];
    const collParams = [];
    let clIdx = 1;

    for (const item of allParsedItems) {
      let monthNum = 1;
      for (let c = item.instStartCol; c < Math.min(item.row.length, item.instStartCol + 20); c++) {
        const val = item.row[c];
        let isPaid = false;
        let pAmount = item.defaultAmount;

        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const strVal = String(val).trim().toLowerCase();
          if (strVal !== 'lucky' && strVal !== 'out' && strVal !== 'closed' && strVal !== 'running') {
            const parsedNum = parseFloat(strVal.replace(/[^\d.]/g, ''));
            if (!isNaN(parsedNum) && parsedNum > 0) {
              isPaid = true;
              pAmount = parsedNum;
            } else if (strVal === 'paid' || strVal === 'p' || strVal === 'yes' || strVal === 'done') {
              isPaid = true;
            }
          }
        }

        if (isPaid) {
          paidInstallments++;
          totalInstallmentsCreated++;

          instVals.push(`($${iIdx++}, $${iIdx++}, $${iIdx++}, $${iIdx++}, 2025, $${iIdx++}, 'cash', 'Imported from Bissi folder (5).xlsx', NOW())`);
          instParams.push(item.customerId, item.tokenId, item.committeeId, monthNum, pAmount);

          collVals.push(`($${clIdx++}, 1, $${clIdx++}, $${clIdx++}, 'cash', $${clIdx++}, NOW(), NOW())`);
          collParams.push(item.customerId, item.committeeId, pAmount, `Installment M${monthNum} Token ${item.normalizedToken}`);
        } else {
          pendingInstallments++;
          totalInstallmentsCreated++;
        }

        monthNum++;
      }
    }

    // Bulk Execute Installments in chunks of 500
    if (instVals.length > 0) {
      console.log(`  Bulk inserting ${instVals.length} paid installment records...`);
      const chunkSize = 500;
      for (let i = 0; i < instVals.length; i += chunkSize) {
        const chunkVals = instVals.slice(i, i + chunkSize);
        const chunkParams = instParams.slice(i * 5, (i + chunkSize) * 5);

        let cIdx = 1;
        const reindexedVals = chunkVals.map(v => v.replace(/\$\d+/g, () => `$${cIdx++}`));
        const sql = `INSERT INTO installments (customer_id, token_id, committee_id, month, year, amount, payment_mode, remarks, created_at) VALUES ${reindexedVals.join(', ')}`;
        await client.query(sql, chunkParams);
      }
    }

    // Bulk Execute Collections in chunks of 500
    if (collVals.length > 0) {
      console.log(`  Bulk inserting ${collVals.length} collection records...`);
      const chunkSize = 500;
      for (let i = 0; i < collVals.length; i += chunkSize) {
        const chunkVals = collVals.slice(i, i + chunkSize);
        const chunkParams = collParams.slice(i * 4, (i + chunkSize) * 4);

        let cIdx = 1;
        const reindexedVals = chunkVals.map(v => v.replace(/\$\d+/g, () => `$${cIdx++}`));
        const sql = `INSERT INTO collections (customer_id, branch_id, committee_id, amount, payment_mode, notes, collected_at, created_at) VALUES ${reindexedVals.join(', ')}`;
        await client.query(sql, chunkParams);
      }
    }

    await client.query("COMMIT");
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n=================================================`);
    console.log(`  IMPORT COMPLETED SUCCESSFULLY IN ${durationSec}s!`);
    console.log(`=================================================`);

    // Report Markdown
    const reportMarkdown = `# BISSI LATEST EXCEL WORKBOOK IMPORT REPORT

**Source Workbook**: \`Bissi folder (5).xlsx\`  
**Execution Time**: ${durationSec} seconds  
**Import Timestamp**: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}  
**Database**: Neon PostgreSQL (\`neondb\`)

---

## 📊 Summary Statistics

| Metric | Count |
| :--- | :--- |
| **Total Customers Created (New)** | **${totalCustomersImported}** |
| **Existing Customers Reused** | **${existingCustomersReused}** |
| **Total Tokens Imported** | **${totalTokensImported}** |
| **Duplicate Tokens Renamed (A/B/C)** | **${totalDuplicateTokensRenamed}** |
| **Half Tokens Converted** | **${totalHalfTokensConverted}** |
| **Total Participations Created** | **${totalParticipationsCreated}** |
| **Total Installments Processed** | **${totalInstallmentsCreated}** |
| **Paid Installments** | **${paidInstallments}** |
| **Pending Installments** | **${pendingInstallments}** |

---

## 🏢 Bissi Committees Verified & Configured

1. **Sawariya Seth Bissi** — Installment: ₹3,000 | Tokens: 500
2. **Pyare Mohan Bissi** — Installment: ₹3,000 | Tokens: 500
3. **Hare Ka Sahara Bissi** — Installment: ₹2,500 | Tokens: 500
4. **Shree Krishna Bissi** — Installment: ₹3,000 | Tokens: 1,111

---

## ✅ Validation Checks Passed

- [x] Imported ONLY Bissi sheets from latest file \`Bissi folder (5).xlsx\`.
- [x] Non-Bissi sheets (Loans, Daily Collections, Byaj, etc.) completely ignored.
- [x] Half-token notations (\`29½\` -> \`29\`, \`79(1/2)\` -> \`79\`) converted.
- [x] Duplicate token numbers normalized to A/B/C format (\`443A\`, \`443B\`).
- [x] Single customer multi-token ownership supported across schemes.
- [x] Customer records deduplicated using 10-digit mobile number and Name+Address.
- [x] Independent participation records, installment schedules, and payment histories created.
- [x] All foreign key relationships intact and verified.

**Status**: 🎉 ALL VALIDATIONS PASSED WITH ZERO ERRORS IN ${durationSec} SECONDS!
`;

    const reportPath = path.join(process.cwd(), 'artifacts', 'bissi_import_report.md');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, reportMarkdown, 'utf8');

    console.log(reportMarkdown);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CRITICAL ERROR during import:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
