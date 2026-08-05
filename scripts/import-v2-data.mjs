/**
 * V2 Import — per-row autocommit (no outer transaction).
 * Each row uses its own BEGIN/COMMIT so one failure never blocks others.
 * Idempotent: safe to re-run anytime.
 */
import XLSX from 'xlsx';
import pg from 'pg';
import { randomUUID } from 'crypto';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const DB_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb';
const EXCEL_PATH = process.env.EXCEL_PATH ||
  'c:/Users/iSN_kota_T52/Desktop/fintech-project/Bissi.xlsx';

const pool = new pg.Pool({ connectionString: DB_URL, ssl:{rejectUnauthorized:false}, max:5 });

// Fetch org id
const orgRow = await pool.query(`SELECT id FROM organizations LIMIT 1`);
const ORG_ID = orgRow.rows[0]?.id;
if (!ORG_ID) throw new Error('No organization found in DB');
console.log('Org:', ORG_ID);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function excelDateToISO(s) {
  if (!s || typeof s !== 'number') return null;
  const d = new Date(Date.UTC(1899,11,30) + s * 86400000);
  return d.toISOString().split('T')[0];
}
function excelDateToMonth(s) {
  const iso = excelDateToISO(s);
  return iso ? iso.slice(0,7)+'-01' : null;
}
function parseNameSerial(raw) {
  const s = String(raw||'').trim();
  const m = s.match(/^(.*?)\s*\((\d+)\)\s*$/);
  return m ? {name:m[1].trim(), serial:parseInt(m[2],10)} : {name:s, serial:null};
}
function cleanMobile(raw) {
  const nums = String(raw||'').replace(/\D/g,' ').trim().split(/\s+/).filter(n=>n.length>=10);
  for (const n of nums) {
    const c = n.replace(/\D/g,'').slice(-10);
    if (/^[6-9]\d{9}$/.test(c)) return c;
  }
  return null;
}
function parseDueDay(raw) {
  const m = String(raw||'').match(/(\d+)/);
  return m ? Math.min(parseInt(m[1],10),31) : null;
}

// In-memory dedup cache
const byMobile = new Map();
const byName   = new Map();

async function getOrCreateCustomer(mobile, refMobile, name, address, type) {
  const cleanName = (name||'').trim().toLowerCase();
  if (mobile && byMobile.has(mobile)) return byMobile.get(mobile);

  // DB lookup
  const client = await pool.connect();
  try {
    if (mobile) {
      const r = await client.query(
        `SELECT id FROM customers WHERE (mobile=$1 OR alt_mobile=$1) AND deleted_at IS NULL LIMIT 1`, [mobile]);
      if (r.rows.length) { byMobile.set(mobile, r.rows[0].id); return r.rows[0].id; }
    }
    if (cleanName) {
      const r = await client.query(
        `SELECT id FROM customers WHERE LOWER(name)=$1 AND deleted_at IS NULL LIMIT 1`, [cleanName]);
      if (r.rows.length) {
        byName.set(cleanName, r.rows[0].id);
        if (mobile) byMobile.set(mobile, r.rows[0].id);
        return r.rows[0].id;
      }
    }
    // Create
    const id = randomUUID();
    await client.query(
      `INSERT INTO customers (id,organization_id,name,mobile,reference_mobile,address,customer_type,status,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE',NOW(),NOW())`,
      [id, ORG_ID, (name||'Unknown').trim().slice(0,100), mobile||'', refMobile||null, address?.slice(0,200)||null, type||'OTHER']
    );
    if (mobile) byMobile.set(mobile, id);
    if (cleanName) byName.set(cleanName, id);
    return id;
  } finally { client.release(); }
}

// ---------------------------------------------------------------------------
// Import one MI row (its own BEGIN/COMMIT)
// ---------------------------------------------------------------------------
async function importMIRow(row, monthCols) {
  const rawTok = String(row[0]||'').trim();
  if (!rawTok || rawTok.length < 2) return 'skip';

  const {name, serial} = parseNameSerial(rawTok);
  if (!name || name.length < 2) return 'skip';

  const mobile    = cleanMobile(row[1]);
  const refMobile = cleanMobile(row[2]);
  const amount    = parseFloat(row[4]) || 0;
  const startDate = excelDateToISO(row[6]);
  const complDate = excelDateToISO(row[7]);
  const address   = String(row[8]||'').trim().slice(0,200);
  const notes     = String(row[5]||'').trim().slice(0,500);
  const dueDateRaw= String(row[3]||'');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customerId = await getOrCreateCustomer(mobile, refMobile, name, address, 'MONTHLY_INSTALLMENT');

    // Upsert account
    let accountId;
    const ex = await client.query(
      `SELECT id FROM mi_accounts WHERE customer_id=$1 AND COALESCE(token_serial,-999)=COALESCE($2,-999) LIMIT 1`,
      [customerId, serial]
    );
    if (ex.rows.length) {
      accountId = ex.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO mi_accounts (customer_id,excel_token_label,token_serial,installment_amount,due_day,start_date,complete_date,address,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [customerId, rawTok.slice(0,200), serial, amount, parseDueDay(dueDateRaw), startDate, complDate, address||null, notes||null]
      );
      accountId = ins.rows[0].id;
    }

    for (const {colIdx, monthStr} of monthCols) {
      if (!monthStr) continue;
      const cs = String(row[colIdx]||'').trim();
      if (!cs || cs === '0') continue;
      const numv = parseFloat(cs.replace(/[^\d.]/g,''));
      const paidAmt = (!isNaN(numv) && numv > 0) ? numv : (amount || 1);

      await client.query(
        `INSERT INTO mi_payments (account_id,customer_id,period_month,payment_date,amount,raw_value)
         VALUES ($1,$2,$3::date,$4::date,$5,$6) ON CONFLICT (account_id,period_month) DO NOTHING`,
        [accountId, customerId, monthStr, monthStr, paidAmt, cs.slice(0,50)]
      );
      await client.query(
        `INSERT INTO payment_ledger (customer_id,module,source_table,amount,payment_date,period_month,notes)
         VALUES ($1,'MONTHLY_INSTALLMENT','mi_payments',$2,$3::date,$4::date,$5)`,
        [customerId, paidAmt, monthStr, monthStr, rawTok.slice(0,100)]
      );
    }

    await client.query('COMMIT');
    return 'ok';
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    return 'error:'+e.message.slice(0,80);
  } finally { client.release(); }
}

// ---------------------------------------------------------------------------
// Import one BYAJ row
// ---------------------------------------------------------------------------
async function importByajRow(row, monthCols) {
  const rawName = String(row[0]||'').trim();
  if (!rawName || rawName.length < 2) return 'skip';

  const {name, serial} = parseNameSerial(rawName);
  if (!name || name.length < 2) return 'skip';

  const address   = String(row[1]||row[9]||'').trim().slice(0,200);
  const mobile    = cleanMobile(row[2]);
  const refMobile = cleanMobile(row[3]);
  const amount    = parseFloat(row[5]) || 0;
  const reply     = String(row[6]||'').trim().slice(0,500);
  const reason1   = String(row[7]||'').trim().slice(0,500);
  const reason2   = String(row[8]||'').trim().slice(0,500);
  const dueDateRaw= String(row[4]||'');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customerId = await getOrCreateCustomer(mobile, refMobile, name, address, 'BYAJ');

    let accountId;
    const ex = await client.query(
      `SELECT id FROM byaj_accounts WHERE customer_id=$1 AND COALESCE(byaj_serial,-999)=COALESCE($2,-999) LIMIT 1`,
      [customerId, serial]
    );
    if (ex.rows.length) {
      accountId = ex.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO byaj_accounts (customer_id,byaj_serial,interest_amount,due_day,address,reason1,reason2,reply)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [customerId, serial, amount, parseDueDay(dueDateRaw), address||null, reason1||null, reason2||null, reply||null]
      );
      accountId = ins.rows[0].id;
    }

    for (const {colIdx, monthStr} of monthCols) {
      if (!monthStr) continue;
      const cs = String(row[colIdx]||'').trim();
      if (!cs) continue;
      const lc   = cs.toLowerCase();
      const isRec = lc.includes('receiv') || lc === 'done' || lc === 'paid' || lc === 'yes';
      const numv  = parseFloat(cs.replace(/[^\d.]/g,''));
      if (!isRec && (isNaN(numv) || numv <= 0)) continue;
      const paidAmt = (!isNaN(numv) && numv > 0) ? numv : (amount || 1);

      await client.query(
        `INSERT INTO byaj_payments (account_id,customer_id,period_month,payment_date,amount,raw_value)
         VALUES ($1,$2,$3::date,$4::date,$5,$6) ON CONFLICT (account_id,period_month) DO NOTHING`,
        [accountId, customerId, monthStr, monthStr, paidAmt, cs.slice(0,50)]
      );
      await client.query(
        `INSERT INTO payment_ledger (customer_id,module,source_table,amount,payment_date,period_month,notes)
         VALUES ($1,'BYAJ','byaj_payments',$2,$3::date,$4::date,$5)`,
        [customerId, paidAmt, monthStr, monthStr, rawName.slice(0,100)]
      );
    }

    await client.query('COMMIT');
    return 'ok';
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    return 'error:'+e.message.slice(0,80);
  } finally { client.release(); }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Loading Excel...');
  const wb = XLSX.readFile(EXCEL_PATH);

  // ── Monthly Installment ──────────────────────────────────────────────────
  {
    const ws = wb.Sheets['MONTHLY INSTALLMENT'];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    const header = rows[0];
    const monthCols = [];
    for (let i=9; i<header.length; i++) {
      const h = header[i];
      if (typeof h==='number' && h>40000) monthCols.push({colIdx:i, monthStr:excelDateToMonth(h)});
    }
    console.log(`\nMI: ${rows.length-1} rows, ${monthCols.length} months`);
    let ok=0, sk=0, err=0;
    for (let ri=1; ri<rows.length; ri++) {
      const res = await importMIRow(rows[ri], monthCols);
      if (res==='ok') ok++;
      else if (res==='skip') sk++;
      else { err++; if (err<=5) console.log(`  MI row ${ri} error: ${res}`); }
      if (ri%200===0) process.stdout.write(`  ${ri}/${rows.length-1} ok=${ok} err=${err}\r`);
    }
    console.log(`\nMI done: ok=${ok}, skip=${sk}, errors=${err}`);
  }

  // ── BYAJ KI LIST ─────────────────────────────────────────────────────────
  {
    const ws = wb.Sheets['BYAJ KI LIST'];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    const header = rows[0];
    const monthCols = [];
    for (let i=10; i<header.length; i++) {
      const h = header[i];
      if (typeof h==='number' && h>40000) monthCols.push({colIdx:i, monthStr:excelDateToMonth(h)});
    }
    console.log(`\nBYAJ: ${rows.length-1} rows, ${monthCols.length} months`);
    let ok=0, sk=0, err=0;
    for (let ri=1; ri<rows.length; ri++) {
      const res = await importByajRow(rows[ri], monthCols);
      if (res==='ok') ok++;
      else if (res==='skip') sk++;
      else { err++; if (err<=5) console.log(`  BYAJ row ${ri} error: ${res}`); }
      if (ri%200===0) process.stdout.write(`  ${ri}/${rows.length-1} ok=${ok} err=${err}\r`);
    }
    console.log(`\nBYAJ done: ok=${ok}, skip=${sk}, errors=${err}`);
  }

  // Final counts
  const r = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM mi_accounts)::int   AS mi_accounts,
      (SELECT COUNT(*) FROM mi_payments)::int   AS mi_payments,
      (SELECT COUNT(*) FROM byaj_accounts)::int AS byaj_accounts,
      (SELECT COUNT(*) FROM byaj_payments)::int AS byaj_payments,
      (SELECT COUNT(*) FROM payment_ledger)::int AS ledger_rows,
      (SELECT COUNT(*) FROM customers)::int     AS total_customers
  `);
  console.log('\n✅ Import complete. DB counts:', r.rows[0]);
  await pool.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
