import XLSX from 'xlsx';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("🚀 Starting Bissi folder (4).xlsx Data Import...\n");
  const client = await pool.connect();

  try {
    const wb = XLSX.readFile('C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx');
    console.log("✓ Successfully read Bissi folder (4).xlsx");

    // Get default Organization ID
    let orgRes = await client.query(`SELECT id FROM organizations LIMIT 1`);
    let orgId = orgRes.rows[0]?.id;
    if (!orgId) {
      const newOrg = await client.query(`INSERT INTO organizations (name, code) VALUES ('SKA Bissi', 'SKA-01') RETURNING id`);
      orgId = newOrg.rows[0].id;
    }

    // Alter column types to text for daily diary if needed
    try {
      await client.query(`ALTER TABLE daily_diary_loans ALTER COLUMN mobile_number TYPE TEXT`);
      await client.query(`ALTER TABLE daily_diary_loans ALTER COLUMN customer_name TYPE TEXT`);
    } catch (e) {}

    // -------------------------------------------------------------
    // 1. IMPORT DAILY DIARY ACCOUNTS
    // -------------------------------------------------------------
    console.log("\n--- Processing Daily Diary Sheet ---");
    const ddSheet = wb.Sheets['daily diary'];
    if (ddSheet) {
      const ddRows = XLSX.utils.sheet_to_json(ddSheet, { header: 1, defval: '' });
      console.log(`Total rows in daily diary: ${ddRows.length}`);

      let ddInserted = 0;
      let ddUpdated = 0;

      for (let i = 1; i < ddRows.length; i++) {
        const row = ddRows[i];
        const rawName = String(row[0] || '').trim();
        if (!rawName) continue;

        const customerName = rawName;
        let mobileNumber = String(row[1] || '').trim().replace(/\s+/g, ' ') || '0000000000';
        const refMobile = String(row[2] || '').trim();
        const paymentModeNote = String(row[3] || '').trim();
        const reason = String(row[4] || '').trim();
        const address = String(row[5] || '').trim();
        const security = String(row[6] || '').trim();
        const loanAmount = Number(row[7]) || 0;
        let startDate = row[8] ? String(row[8]).trim() : new Date().toISOString().slice(0, 10);
        let completeDate = row[9] ? String(row[9]).trim() : '';

        if (!isNaN(Number(startDate)) && Number(startDate) > 30000) {
          const d = new Date((Number(startDate) - (25567 + 2)) * 86400 * 1000);
          startDate = d.toISOString().slice(0, 10);
        }
        if (!isNaN(Number(completeDate)) && Number(completeDate) > 30000) {
          const d = new Date((Number(completeDate) - (25567 + 2)) * 86400 * 1000);
          completeDate = d.toISOString().slice(0, 10);
        }

        if (loanAmount <= 0) continue;

        let collectionPlan = "500/day";
        if (loanAmount >= 50000) collectionPlan = "1000/day";
        else if (loanAmount >= 30000) collectionPlan = "500/day";
        else if (loanAmount >= 15000) collectionPlan = "250/day";
        else collectionPlan = "100/day";

        const existingRes = await client.query(
          `SELECT id FROM daily_diary_loans WHERE customer_name = $1 AND mobile_number = $2`,
          [customerName, mobileNumber]
        );

        if (existingRes.rows.length > 0) {
          await client.query(
            `UPDATE daily_diary_loans 
             SET reference_mobile_numbers = $1, address = $2, security = $3, loan_amount = $4, start_date = $5, expected_complete_date = $6, notes = $7, updated_at = NOW()
             WHERE id = $8`,
            [refMobile, address, security, loanAmount, startDate, completeDate, reason || paymentModeNote, existingRes.rows[0].id]
          );
          ddUpdated++;
        } else {
          await client.query(
            `INSERT INTO daily_diary_loans 
             (organization_id, customer_name, mobile_number, reference_mobile_numbers, address, security, loan_amount, start_date, expected_complete_date, collection_plan, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE')`,
            [orgId, customerName, mobileNumber, refMobile, address, security, loanAmount, startDate, completeDate, collectionPlan, reason || paymentModeNote]
          );
          ddInserted++;
        }
      }
      console.log(`✓ Daily Diary Import Complete: ${ddInserted} inserted, ${ddUpdated} updated.`);
    }

    // -------------------------------------------------------------
    // 2. PROCESS BISSI SCHEMES & MEMBER TOKENS
    // -------------------------------------------------------------
    console.log("\n--- Processing Bissi Schemes & Member Tokens ---");

    const bissiSheets = [
      { name: 'Sawariya seth 5 date', schemeName: 'Sawariya Seth Bissi (5th Date)', date: '5th' },
      { name: 'Pyare mohan 15 date', schemeName: 'Pyare Mohan Bissi (15th Date)', date: '15th' },
      { name: 'Hare ka sahara bissi 20 date', schemeName: 'Hare Ka Sahara Bissi (20th Date)', date: '20th' },
      { name: 'Shree Krishna associate lottery', schemeName: 'Shree Krishna Associates Bissi', date: '30th' }
    ];

    for (const bScheme of bissiSheets) {
      const sheet = wb.Sheets[bScheme.name];
      if (!sheet) continue;

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      console.log(`Processing Scheme "${bScheme.schemeName}": ${rows.length - 1} rows`);

      let commRes = await client.query(`SELECT id FROM committees WHERE name ILIKE $1`, [`%${bScheme.name.slice(0, 10)}%`]);
      let committeeId;
      if (commRes.rows.length === 0) {
        const code = bScheme.name.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const newComm = await client.query(
          `INSERT INTO committees (organization_id, name, code, total_members, total_months, monthly_installment, start_date, status) 
           VALUES ($1, $2, $3, 500, 20, 3000, CURRENT_DATE, 'ACTIVE') RETURNING id`,
          [orgId, bScheme.schemeName, code]
        );
        committeeId = newComm.rows[0].id;
      } else {
        committeeId = commRes.rows[0].id;
      }

      let tokensInserted = 0;
      let tokensUpdated = 0;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        let rawToken = row[0] !== undefined ? String(row[0]).trim() : '';
        const nameVal = String(row[1] || '').trim();
        const refVal = String(row[2] || '').trim().slice(0, 20);
        let mobVal = String(row[3] || row[5] || '').trim().replace(/\s+/g, ' ').slice(0, 20);
        const addressVal = String(row[5] || row[4] || '').trim();

        if (!rawToken || !nameVal) continue;

        // Apply User Directives:
        if (bScheme.name === 'Sawariya seth 5 date' && rawToken === '443') {
          if (nameVal.toLowerCase().includes('ankita')) rawToken = '443A';
          else if (nameVal.toLowerCase().includes('asha')) rawToken = '443B';
        }

        if (bScheme.name === 'Shree Krishna associate lottery' && rawToken === '3') {
          if (nameVal.toLowerCase().includes('hitansh')) rawToken = '3A';
          else if (nameVal.toLowerCase().includes('choth')) rawToken = '3B';
        }

        const normNum = parseInt(rawToken) || 0;

        // Ensure Customer exists
        let custRes = await client.query(`SELECT id FROM customers WHERE name = $1 AND (mobile = $2 OR $2 = '')`, [nameVal, mobVal]);
        let customerId;
        if (custRes.rows.length === 0) {
          const newCust = await client.query(
            `INSERT INTO customers (organization_id, name, mobile, address, alt_mobile, status) VALUES ($1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
            [orgId, nameVal, mobVal || '0000000000', addressVal, refVal]
          );
          customerId = newCust.rows[0].id;
        } else {
          customerId = custRes.rows[0].id;
        }

        // Insert or Update Token
        const tokRes = await client.query(
          `SELECT id FROM tokens WHERE committee_id = $1 AND raw_token_number = $2`,
          [committeeId, rawToken]
        );

        if (tokRes.rows.length > 0) {
          await client.query(
            `UPDATE tokens SET customer_id = $1, status = 'ACTIVE' WHERE id = $2`,
            [customerId, tokRes.rows[0].id]
          );
          tokensUpdated++;
        } else {
          await client.query(
            `INSERT INTO tokens (organization_id, committee_id, customer_id, raw_token_number, normalized_token_number, status) VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
            [orgId, committeeId, customerId, rawToken, normNum]
          );
          tokensInserted++;
        }
      }
      console.log(`✓ Scheme "${bScheme.schemeName}": ${tokensInserted} tokens inserted, ${tokensUpdated} updated.`);
    }

    // -------------------------------------------------------------
    // 3. PROCESS GIFT RECORDS INTO LOTTERY MODULE
    // -------------------------------------------------------------
    console.log("\n--- Processing Gift Records ---");

    const giftSheets = [
      { name: 'Sawariya seth bissi gift record', bissiName: 'Sawariya Seth Bissi (5th Date)' },
      { name: 'Pyare mohan bissi gift records', bissiName: 'Pyare Mohan Bissi (15th Date)' },
      { name: 'Hare ka sahara bissi gift recor', bissiName: 'Hare Ka Sahara Bissi (20th Date)' },
      { name: 'Shree krishna aasociates gift r', bissiName: 'Shree Krishna Associates Bissi' }
    ];

    let totalGiftsSaved = 0;

    for (const gObj of giftSheets) {
      const gSheet = wb.Sheets[gObj.name];
      if (!gSheet) continue;

      const gRows = XLSX.utils.sheet_to_json(gSheet, { header: 1, defval: '' });
      if (gRows.length <= 1) continue;

      const header = gRows[0];
      const monthCols = [];
      header.forEach((hVal, colIdx) => {
        if (colIdx >= 5 && hVal) {
          let dateStr = String(hVal);
          if (!isNaN(Number(hVal))) {
            const parsedD = new Date((Number(hVal) - (25567 + 2)) * 86400 * 1000);
            dateStr = parsedD.toISOString().slice(0, 10);
          }
          monthCols.push({ colIdx, monthLabel: dateStr });
        }
      });

      console.log(`Processing Gift Sheet "${gObj.name}": Found ${monthCols.length} draw months`);

      for (const mCol of monthCols) {
        let sessRes = await client.query(
          `SELECT id FROM lottery_sessions WHERE bissi_name = $1 AND lottery_date = $2`,
          [gObj.bissiName, mCol.monthLabel]
        );
        let sessionId;
        if (sessRes.rows.length === 0) {
          const newSess = await client.query(
            `INSERT INTO lottery_sessions (bissi_name, lottery_date, lottery_month, notes) VALUES ($1, $2, $3, 'Imported from Gift Sheet') RETURNING id`,
            [gObj.bissiName, mCol.monthLabel, mCol.monthLabel]
          );
          sessionId = newSess.rows[0].id;
        } else {
          sessionId = sessRes.rows[0].id;
        }

        for (let r = 1; r < gRows.length; r++) {
          const row = gRows[r];
          const tokenNo = String(row[0] || '').trim();
          const customerName = String(row[1] || '').trim();
          const giftItem = String(row[mCol.colIdx] || '').trim();

          if (!tokenNo || !giftItem || giftItem === '0' || giftItem === '-' || giftItem === '.') continue;

          const giftRes = await client.query(
            `SELECT id FROM lottery_gifts WHERE session_id = $1 AND token_number = $2`,
            [sessionId, tokenNo]
          );

          if (giftRes.rows.length === 0) {
            await client.query(
              `INSERT INTO lottery_gifts (session_id, token_number, customer_name, gift_item_name, is_delivered) VALUES ($1, $2, $3, $4, true)`,
              [sessionId, tokenNo, customerName, giftItem]
            );
            totalGiftsSaved++;
          }
        }
      }
    }

    console.log(`✓ Gift Records Import Complete: ${totalGiftsSaved} winning gifts recorded!`);

    console.log("\n===============================================");
    console.log("🎉 ALL DATA FROM Bissi folder (4).xlsx IMPORTED SUCCESSFULLY!");
    console.log("===============================================\n");

  } catch (err) {
    console.error("❌ ERROR during seed import:", err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
