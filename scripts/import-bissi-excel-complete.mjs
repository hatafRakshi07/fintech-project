import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import pg from 'pg';
const { Pool } = pg;

const EXCEL_PATH = 'C:\\Users\\lenovo\\Downloads\\Bissi folder (4).xlsx';

const DB_URLS = [
  { name: 'SUPABASE DB', url: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' },
  { name: 'NEON DB', url: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require' }
];

function cleanPhone(val) {
  if (!val) return null;
  const digits = String(val).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return null;
}

function cleanName(val) {
  if (!val) return '';
  return String(val).trim().replace(/\s+/g, ' ');
}

async function importToDatabase(dbTarget, workbook) {
  console.log(`\n===================================================`);
  console.log(`   STARTING PRECISION BISSI IMPORT TO ${dbTarget.name}`);
  console.log(`===================================================`);

  const pool = new Pool({
    connectionString: dbTarget.url,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // 0. Ensure Branch ID 1
    await client.query(`
      INSERT INTO branches (id, name, code, city, address, status, updated_at)
      VALUES (1, 'Shree Krishna Associate', 'SKA001', 'Main City', 'Main Branch', 'active', NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `);

    // 1. Ensure 4 Bissi Committees with ₹3,000 Installment Amount
    const committeesDef = [
      { id: 1, name: 'Sawariya Seth Bissi', installment_amount: 3000, member_limit: 500, type: 'monthly', branch_id: 1 },
      { id: 2, name: 'Pyare Mohan Bissi', installment_amount: 3000, member_limit: 500, type: 'monthly', branch_id: 1 },
      { id: 3, name: 'Hare Ka Sahara Bissi', installment_amount: 3000, member_limit: 500, type: 'monthly', branch_id: 1 },
      { id: 4, name: 'Shree Krishna Bissi', installment_amount: 3000, member_limit: 1111, type: 'monthly', branch_id: 1 },
    ];

    for (const c of committeesDef) {
      await client.query(`
        INSERT INTO committees (id, name, type, installment_amount, member_limit, branch_id, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, member_limit = EXCLUDED.member_limit, installment_amount = EXCLUDED.installment_amount, branch_id = EXCLUDED.branch_id, updated_at = NOW()
      `, [c.id, c.name, c.type, c.installment_amount, c.member_limit, c.branch_id]);
    }
    console.log(`✓ Ensured 4 Bissi Committees in ${dbTarget.name} (Shree Krishna limit = 1111, others = 500; all ₹3000/mo).`);

    // Clean tables before precision import
    await client.query('TRUNCATE TABLE customers, collections, tokens RESTART IDENTITY CASCADE');

    // 2. Load existing customers into memory
    const existingCust = await client.query('SELECT id, name, mobile FROM customers');
    const custMap = new Map();

    for (const r of existingCust.rows) {
      const mob = cleanPhone(r.mobile);
      if (mob) custMap.set(mob, r.id);
      const n = cleanName(r.name).toLowerCase();
      if (n) custMap.set(n, r.id);
    }

    const sheetBissiMapping = [
      { sheet: 'Sawariya seth 5 date', committeeId: 1, nameIdx: 1, phoneIdx: 3, tokenIdx: 0, statusIdx: 6 },
      { sheet: 'Pyare mohan 15 date', committeeId: 2, nameIdx: 1, phoneIdx: 5, tokenIdx: 0, statusIdx: 6 },
      { sheet: 'Hare ka sahara bissi 20 date', committeeId: 3, nameIdx: 1, phoneIdx: 3, tokenIdx: 0, statusIdx: 6 },
      { sheet: 'Shree Krishna associate lottery', committeeId: 4, nameIdx: 1, phoneIdx: 3, tokenIdx: 0, statusIdx: 5 }
    ];

    const pendingNewCustomers = [];
    let sequenceCounter = existingCust.rows.length;

    for (const item of sheetBissiMapping) {
      if (!workbook.SheetNames.includes(item.sheet)) continue;
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[item.sheet], { header: 1 });

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if (!row || !row[item.nameIdx]) continue;

        const name = cleanName(row[item.nameIdx]);
        if (!name) continue;
        const phone = cleanPhone(row[item.phoneIdx]);
        const key = phone || name.toLowerCase();

        if (!custMap.has(key)) {
          sequenceCounter++;
          const mockPhone = phone || `9000${String(sequenceCounter).padStart(6, '0')}`;
          const refNum = `BS-${sequenceCounter}-${Date.now().toString().slice(-4)}`;
          pendingNewCustomers.push({ name, phone: mockPhone, refNum, key });
          custMap.set(key, -1); // placeholder
        }
      }
    }

    // Bulk Insert New Customers in Chunks of 50
    if (pendingNewCustomers.length > 0) {
      console.log(`Inserting ${pendingNewCustomers.length} unique customers in bulk chunks into ${dbTarget.name}...`);
      const chunkSize = 50;
      for (let i = 0; i < pendingNewCustomers.length; i += chunkSize) {
        const chunk = pendingNewCustomers.slice(i, i + chunkSize);
        const valuePlaceholders = [];
        const params = [];

        chunk.forEach((item, idx) => {
          const p = idx * 3;
          valuePlaceholders.push(`($${p + 1}, $${p + 2}, $${p + 3}, 1, 'active', NOW())`);
          params.push(item.name, item.phone, item.refNum);
        });

        const insertQuery = `
          INSERT INTO customers (name, mobile, reference_number, branch_id, status, updated_at)
          VALUES ${valuePlaceholders.join(', ')}
          RETURNING id, name, mobile
        `;

        const res = await client.query(insertQuery, params);
        for (const r of res.rows) {
          const mob = cleanPhone(r.mobile);
          if (mob) custMap.set(mob, r.id);
          custMap.set(cleanName(r.name).toLowerCase(), r.id);
        }
      }
    }

    console.log(`✓ Total Customer Base Ready in ${dbTarget.name}: ${custMap.size} records.`);

    // 3. Bulk Insert Tokens
    let totalTokens = 0;
    let outMembers = 0;
    const tokensToInsert = [];

    for (const item of sheetBissiMapping) {
      if (!workbook.SheetNames.includes(item.sheet)) continue;
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[item.sheet], { header: 1 });

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if (!row || !row[item.nameIdx]) continue;

        const custName = cleanName(row[item.nameIdx]);
        const phone = cleanPhone(row[item.phoneIdx]);
        const tokenNum = row[item.tokenIdx] ? String(row[item.tokenIdx]).trim() : `TK-${r}`;
        const statusRaw = row[item.statusIdx] ? String(row[item.statusIdx]).toLowerCase() : '';
        const isOut = statusRaw.includes('out') || statusRaw.includes('lucky') || statusRaw.includes('complete');

        const custId = custMap.get(phone) || custMap.get(custName.toLowerCase());
        if (!custId || custId === -1) continue;

        const tokenStatus = isOut ? 'closed' : 'active';
        if (isOut) outMembers++;

        tokensToInsert.push({ tokenNum, custId, committeeId: item.committeeId, tokenStatus });
        totalTokens++;
      }
    }

    // Insert Tokens in Chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < tokensToInsert.length; i += chunkSize) {
      const chunk = tokensToInsert.slice(i, i + chunkSize);
      const valuePlaceholders = [];
      const params = [];

      chunk.forEach((item, idx) => {
        const p = idx * 4;
        valuePlaceholders.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, NOW())`);
        params.push(item.tokenNum, item.custId, item.committeeId, item.tokenStatus);
      });

      await client.query(`
        INSERT INTO tokens (token_number, customer_id, committee_id, status, updated_at)
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT DO NOTHING
      `, params);
    }

    console.log(`✓ Processed Tokens in ${dbTarget.name}. Total: ${totalTokens}, OUT: ${outMembers}.`);

    // 4. Import Bissi Collections
    const collectionSheets = [
      { name: 'Daily collection', collector: 'Daily Collector' },
      { name: 'Manager collection', collector: 'Manager' },
      { name: 'Aayush collection', collector: 'Aayush' },
      { name: 'online collection(nikku ji)', collector: 'Nikku Ji' },
      { name: 'recovery collection', collector: 'Recovery' }
    ];

    const collectionsToInsert = [];

    for (const cSheet of collectionSheets) {
      if (!workbook.SheetNames.includes(cSheet.name)) continue;
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[cSheet.name], { header: 1 });

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if (!row || !row[0]) continue;

        const custName = cleanName(row[0]);
        const cashAmt = Number(row[2]) || 0;
        const onlineAmt = Number(row[3]) || 0;
        const totalAmt = cashAmt + onlineAmt;

        if (totalAmt <= 0) continue;

        const custId = custMap.get(custName.toLowerCase());
        if (!custId || custId === -1) continue;

        const payMode = onlineAmt > 0 ? 'upi' : 'cash';
        const receiptNo = `REC-${cSheet.collector.slice(0, 3).toUpperCase()}-${r}`;
        const notes = `Bissi collection via ${cSheet.collector} (Receipt: ${receiptNo})`;

        collectionsToInsert.push({ custId, totalAmt, payMode, receiptNo, notes });
      }
    }

    const isSupabase = dbTarget.name === 'SUPABASE DB';

    for (let i = 0; i < collectionsToInsert.length; i += chunkSize) {
      const chunk = collectionsToInsert.slice(i, i + chunkSize);
      const valuePlaceholders = [];
      const params = [];

      if (isSupabase) {
        chunk.forEach((item, idx) => {
          const p = idx * 4;
          valuePlaceholders.push(`($${p + 1}, 1, $${p + 2}, $${p + 3}, $${p + 4}, 'verified', NOW())`);
          params.push(item.custId, item.totalAmt, item.payMode, item.notes);
        });

        await client.query(`
          INSERT INTO collections (customer_id, branch_id, amount, payment_mode, notes, verification_status, created_at)
          VALUES ${valuePlaceholders.join(', ')}
        `, params);
      } else {
        chunk.forEach((item, idx) => {
          const p = idx * 5;
          valuePlaceholders.push(`($${p + 1}, 1, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, 'verified', NOW())`);
          params.push(item.custId, item.totalAmt, item.payMode, item.receiptNo, item.notes);
        });

        await client.query(`
          INSERT INTO collections (customer_id, branch_id, amount, payment_mode, receipt_number, notes, verification_status, created_at)
          VALUES ${valuePlaceholders.join(', ')}
        `, params);
      }
    }

    console.log(`✓ Processed ${collectionsToInsert.length} Bissi collections into ${dbTarget.name}.`);

    // Final Verification Query
    const [custRes, commRes, tokenRes, colRes, outRes, perCommTokens] = await Promise.all([
      client.query('SELECT COUNT(*) FROM customers'),
      client.query('SELECT COUNT(*) FROM committees'),
      client.query('SELECT COUNT(*) FROM tokens'),
      client.query('SELECT COUNT(*) FROM collections'),
      client.query("SELECT COUNT(*) FROM tokens WHERE status = 'closed'"),
      client.query(`
        SELECT c.name, COUNT(t.id) as token_count 
        FROM committees c 
        LEFT JOIN tokens t ON t.committee_id = c.id 
        GROUP BY c.id, c.name 
        ORDER BY c.id
      `)
    ]);

    console.log(`\n===================================================`);
    console.log(`    FINAL IMPORT SUMMARY REPORT FOR ${dbTarget.name}`);
    console.log(`===================================================`);
    console.log('✓ Total Customers in DB    :', custRes.rows[0].count);
    console.log('✓ Total Bissi Schemes (4)  :', commRes.rows[0].count);
    console.log('✓ Total Bissi Tokens in DB :', tokenRes.rows[0].count);
    console.log('✓ Active Bissi Tokens      :', parseInt(tokenRes.rows[0].count, 10) - parseInt(outRes.rows[0].count, 10));
    console.log('✓ OUT / Lucky Members      :', outRes.rows[0].count);
    console.log('✓ Total Bissi Collections  :', colRes.rows[0].count);
    console.log('---------------------------------------------------');
    console.log('Tokens Per Bissi Scheme:');
    perCommTokens.rows.forEach(r => {
      console.log(`  - ${r.name.padEnd(25)} : ${r.token_count} tokens`);
    });
    console.log('===================================================\n');

  } catch (err) {
    console.error(`❌ Import failed for ${dbTarget.name}:`, err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  console.log('=== STARTING DUAL-DATABASE BISSI IMPORT (SUPABASE + NEON) ===');
  const workbook = XLSX.readFile(EXCEL_PATH);
  console.log(`Loaded workbook with ${workbook.SheetNames.length} sheets.`);

  for (const dbTarget of DB_URLS) {
    await importToDatabase(dbTarget, workbook);
  }
  console.log('🎉 ALL DATABASES (SUPABASE + NEON) SUCCESSFULLY UPDATED!');
}

main().catch(console.error);
