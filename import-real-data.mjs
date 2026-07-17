/**
 * Import ALL real data from extracted JSON files into PGlite.
 * 
 * This script:
 * 1. Opens PGlite directly (no TCP server needed)
 * 2. Clears existing data
 * 3. Re-runs schema migration
 * 4. Imports: branch, admin user, customers, committees, tokens, 
 *    committee members, collections, interest accounts, loans, 
 *    gift records, lotteries, daily collections
 */

import pgPackage from "pg";
const { Client } = pgPackage;
import { readFileSync } from "fs";
import { join } from "path";

const DATA_DIR = "./pglite-data";
const BASE = process.cwd();

// ─── Load JSON files ─────────────────────────────────────────────────────────

function loadJSON(name) {
  const raw = readFileSync(join(BASE, name), "utf-8");
  return JSON.parse(raw);
}

const customers = loadJSON("extracted_customers.json");
const committees = loadJSON("extracted_committees.json");
const tokens = loadJSON("extracted_tokens.json");
const collections = loadJSON("extracted_collections.json");
const interests = loadJSON("extracted_interests.json");
const loans = loadJSON("extracted_loans.json");
const dailyCollections = loadJSON("extracted_daily_collections.json");
const gifts = loadJSON("extracted_gifts.json");
const lotteries = loadJSON("extracted_lotteries.json");

console.log("Loaded JSON files:");
console.log(`  Customers: ${customers.length}`);
console.log(`  Committees: ${committees.length}`);
console.log(`  Tokens: ${tokens.length}`);
console.log(`  Collections: ${collections.length}`);
console.log(`  Interests: ${interests.length}`);
console.log(`  Loans: ${loans.length}`);
console.log(`  Daily Collections: ${dailyCollections.length}`);
console.log(`  Gifts: ${gifts.length}`);
console.log(`  Lotteries: ${lotteries.length}`);

// ─── Open Database Connection ────────────────────────────────────────────────

console.log("\n── Connecting to database server...");
const connectionString = process.env.DATABASE_URL || "postgresql://postgres@127.0.0.1:5432/bissi_db";
const pg = new Client({
  connectionString
});
await pg.connect();
pg.exec = (q) => pg.query(q);
pg.close = () => pg.end();
console.log("  ✓ Database connected");

// ─── Helper: escape SQL string ───────────────────────────────────────────────

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function escNum(v) {
  if (v === null || v === undefined) return "NULL";
  const n = Number(v);
  return isNaN(n) ? "NULL" : `'${n.toFixed(2)}'`;
}

// ─── Clear all data ──────────────────────────────────────────────────────────

console.log("\n── Clearing existing data...");
const tables = [
  "recovery_call_logs", "recovery_tasks",
  "interest_transactions", "interest_accounts",
  "gift_distributions", "gift_inventory", "gift_categories",
  "lotteries", "collections", "installments",
  "tokens", "committee_members", "committees",
  "loans", "collectors", "customers",
  "sessions", "users", "branches",
  "notifications", "ledger_entries",
];

for (const t of tables) {
  try {
    await pg.exec(`DELETE FROM ${t};`);
    // Reset serial
    try { await pg.exec(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1;`); } catch(e) {}
  } catch(e) {
    // Table may not exist
  }
}
console.log("  ✓ All tables cleared");

// ─── 1. Create Branch ───────────────────────────────────────────────────────

console.log("\n── Creating branch...");
const branchResult = await pg.query(`
  INSERT INTO branches (name, code, city, address, phone, manager_name, status)
  VALUES ('Bissi Main Office', 'KOTA001', 'Kota', 'Kota, Rajasthan', '0744-0000000', 'Admin', 'active')
  RETURNING id;
`);
const branchId = branchResult.rows[0].id;
console.log(`  ✓ Branch created (id=${branchId})`);

// ─── 2. Create Admin User ───────────────────────────────────────────────────

console.log("\n── Creating admin user...");
// Real bcrypt hash for password 'admin123' (cost=12)
const fakeHash = "$2b$12$16iWUxslobJbIjLVPSBJFOEI7V1RW9Nig3ESdBFmnUnXOsvMnlsnS";
await pg.query(`
  INSERT INTO users (username, password_hash, name, role)
  VALUES ('admin', ${esc(fakeHash)}, 'Administrator', 'super_admin');
`);
console.log("  ✓ Admin user created");

// ─── 3. Import Customers ────────────────────────────────────────────────────

console.log("\n── Importing customers...");
const BATCH_SIZE = 100;
const customerIdMap = {}; // _idx -> db id
let customerCount = 0;

for (let i = 0; i < customers.length; i += BATCH_SIZE) {
  const batch = customers.slice(i, i + BATCH_SIZE);
  const values = batch.map((c, j) => {
    const refNum = `CUST-${String(i + j + 1).padStart(5, '0')}`;
    const name = c.name || 'Unknown';
    const mobile = c.mobile || 'N/A';
    const refName = c.reference_name;
    const refMobile = c.reference_mobile;
    const address = c.address;
    const reason = c.reason; // use recovery_notes for reason
    return `(${esc(refNum)}, ${esc(name)}, ${esc(mobile)}, ${esc(refMobile)}, ${esc(address)}, ${esc(refName)}, ${esc(reason)}, ${branchId}, 'active')`;
  }).join(",\n");
  
  const result = await pg.query(`
    INSERT INTO customers (reference_number, name, mobile, alternate_mobile, address, reference_name, recovery_notes, branch_id, status)
    VALUES ${values}
    RETURNING id;
  `);
  
  for (let j = 0; j < result.rows.length; j++) {
    customerIdMap[batch[j]._idx] = result.rows[j].id;
  }
  customerCount += result.rows.length;
  
  if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= customers.length) {
    process.stdout.write(`\r  Imported ${customerCount}/${customers.length} customers`);
  }
}
console.log(`\n  ✓ Imported ${customerCount} customers`);

// Build customer key -> db id map
const keyToDbId = {};
for (const c of customers) {
  keyToDbId[c._key] = customerIdMap[c._idx];
}

// ─── 4. Import Committees ───────────────────────────────────────────────────

console.log("\n── Importing committees...");
const committeeIdMap = {}; // idx -> db id

for (const com of committees) {
  const result = await pg.query(`
    INSERT INTO committees (name, type, installment_amount, member_limit, status, branch_id)
    VALUES (${esc(com.name)}, ${esc(com.type)}, ${escNum(com.installment)}, 2000, 'active', ${branchId})
    RETURNING id;
  `);
  committeeIdMap[com.idx] = result.rows[0].id;
}
console.log(`  ✓ Created ${committees.length} committees`);

// ─── 5. Import Tokens & Committee Members ───────────────────────────────────

console.log("\n── Importing tokens & committee members...");
let tokenCount = 0;

for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
  const batch = tokens.slice(i, i + BATCH_SIZE);
  
  // Tokens
  const tokenValues = batch
    .filter(t => keyToDbId[t.customer_key] && committeeIdMap[t.committee_idx] !== undefined)
    .map(t => {
      const custId = keyToDbId[t.customer_key];
      const comId = committeeIdMap[t.committee_idx];
      return `(${esc(t.token_number)}, ${custId}, ${comId}, 'active')`;
    });
  
  if (tokenValues.length > 0) {
    await pg.query(`
      INSERT INTO tokens (token_number, customer_id, committee_id, status)
      VALUES ${tokenValues.join(",\n")};
    `);
    
    // Also insert committee members
    const memberValues = batch
      .filter(t => keyToDbId[t.customer_key] && committeeIdMap[t.committee_idx] !== undefined)
      .map(t => {
        const custId = keyToDbId[t.customer_key];
        const comId = committeeIdMap[t.committee_idx];
        return `(${comId}, ${custId}, ${esc(t.token_number)}, 'active')`;
      });
    
    await pg.query(`
      INSERT INTO committee_members (committee_id, customer_id, token_number, status)
      VALUES ${memberValues.join(",\n")};
    `);
    
    tokenCount += tokenValues.length;
  }
  
  if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= tokens.length) {
    process.stdout.write(`\r  Imported ${tokenCount}/${tokens.length} tokens`);
  }
}
console.log(`\n  ✓ Imported ${tokenCount} tokens & committee members`);

// ─── 6. Import Committee Collections ────────────────────────────────────────

console.log("\n── Importing committee collections...");
let collCount = 0;

for (let i = 0; i < collections.length; i += BATCH_SIZE) {
  const batch = collections.slice(i, i + BATCH_SIZE);
  const valid = batch.filter(c => keyToDbId[c.customer_key] && committeeIdMap[c.committee_idx] !== undefined);
  
  if (valid.length > 0) {
    const values = valid.map(c => {
      const custId = keyToDbId[c.customer_key];
      const comId = committeeIdMap[c.committee_idx];
      const dateStr = c.date || '2025-01-01';
      return `(${custId}, ${branchId}, ${comId}, ${escNum(c.amount)}, 'cash', '${dateStr}T10:00:00Z')`;
    }).join(",\n");
    
    await pg.query(`
      INSERT INTO collections (customer_id, branch_id, committee_id, amount, payment_mode, collected_at)
      VALUES ${values};
    `);
    collCount += valid.length;
  }
  
  if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= collections.length) {
    process.stdout.write(`\r  Imported ${collCount}/${collections.length} collections`);
  }
}
console.log(`\n  ✓ Imported ${collCount} committee collections`);

// ─── 7. Import Daily Collections ────────────────────────────────────────────

console.log("\n── Importing daily collections...");
let dailyCount = 0;

for (let i = 0; i < dailyCollections.length; i += BATCH_SIZE) {
  const batch = dailyCollections.slice(i, i + BATCH_SIZE);
  const valid = batch.filter(c => keyToDbId[c.customer_key]);
  
  if (valid.length > 0) {
    const values = valid.map(c => {
      const custId = keyToDbId[c.customer_key];
      const amount = c.credit_cash || c.credit_online || c.debit_cash || c.debit_online || 0;
      if (!amount || amount <= 0) return null;
      const mode = c.credit_online || c.debit_online ? 'upi' : 'cash';
      const dateStr = c.date || '2025-01-01';
      const notes = c.source || '';
      return `(${custId}, ${branchId}, ${escNum(amount)}, '${mode}', '${dateStr}T10:00:00Z', ${esc(notes)})`;
    }).filter(v => v !== null).join(",\n");
    
    if (values.length > 0) {
      await pg.query(`
        INSERT INTO collections (customer_id, branch_id, amount, payment_mode, collected_at, notes)
        VALUES ${values};
      `);
      dailyCount += values.split("\n").length;
    }
  }
  
  if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= dailyCollections.length) {
    process.stdout.write(`\r  Imported ~${dailyCount} daily collections`);
  }
}
console.log(`\n  ✓ Imported ~${dailyCount} daily collections`);

// ─── 8. Import Interest Accounts ────────────────────────────────────────────

console.log("\n── Importing interest accounts...");
let intCount = 0;

for (const int of interests) {
  const custId = keyToDbId[int.customer_key];
  if (!custId) continue;
  
  const amount = int.interest_amount || 0;
  const rate = 2.0; // default 2% monthly
  
  try {
    await pg.query(`
      INSERT INTO interest_accounts (customer_id, principal_amount, interest_rate, start_date, monthly_interest, status, branch_id, notes)
      VALUES (${custId}, ${escNum(amount * 100)}, '2.00', '2025-01-01', ${escNum(amount)}, 'active', ${branchId}, ${esc(int.interest_date || '')});
    `);
    intCount++;
  } catch(e) {
    // skip duplicates
  }
}
console.log(`  ✓ Imported ${intCount} interest accounts`);

// ─── 9. Import Loans ────────────────────────────────────────────────────────

console.log("\n── Importing loans...");
let loanCount = 0;

for (const loan of loans) {
  const custId = keyToDbId[loan.customer_key];
  if (!custId) continue;
  
  const loanAmt = loan.loan_amount || loan.debit_cash || loan.debit_online;
  if (!loanAmt || loanAmt <= 0) continue;
  
  const interest = loan.interest || 0;
  const deposit = loan.loan_deposit || loan.credit_cash || loan.credit_online || 0;
  const rate = loanAmt > 0 && interest > 0 ? ((interest / loanAmt) * 100).toFixed(2) : '2.00';
  
  try {
    await pg.query(`
      INSERT INTO loans (customer_id, principal_amount, interest_rate, interest_type, tenure, paid_amount, status, branch_id, purpose)
      VALUES (${custId}, ${escNum(loanAmt)}, '${rate}', 'flat', 12, ${escNum(deposit)}, 'active', ${branchId}, ${esc(loan.customer_name + ' - Loan')});
    `);
    loanCount++;
  } catch(e) {
    // skip
  }
}
console.log(`  ✓ Imported ${loanCount} loans`);

// ─── 10. Import Gift Categories & Distributions ─────────────────────────────

console.log("\n── Importing gift records...");

// Create a default gift category
const giftCatResult = await pg.query(`
  INSERT INTO gift_categories (name, description, branch_id)
  VALUES ('Bissi Gifts', 'Committee monthly gifts', ${branchId})
  RETURNING id;
`);
const giftCatId = giftCatResult.rows[0].id;

// Get unique gift names for inventory
const giftNames = new Set();
for (const g of gifts) {
  if (g.gift_name) giftNames.add(g.gift_name);
}

// Create gift inventory items
const giftInventoryMap = {};
for (const gName of giftNames) {
  try {
    const r = await pg.query(`
      INSERT INTO gift_inventory (category_id, name, quantity_total, quantity_available, status, branch_id)
      VALUES (${giftCatId}, ${esc(gName)}, 100, 100, 'available', ${branchId})
      RETURNING id;
    `);
    giftInventoryMap[gName] = r.rows[0].id;
  } catch(e) {}
}
console.log(`  Created ${Object.keys(giftInventoryMap).length} gift inventory items`);

// Import gift distributions
let giftCount = 0;
for (let i = 0; i < gifts.length; i += BATCH_SIZE) {
  const batch = gifts.slice(i, i + BATCH_SIZE);
  const valid = batch.filter(g => {
    const custId = keyToDbId[g.customer_key];
    const giftId = giftInventoryMap[g.gift_name];
    return custId && giftId;
  });
  
  if (valid.length > 0) {
    const values = valid.map(g => {
      const custId = keyToDbId[g.customer_key];
      const giftId = giftInventoryMap[g.gift_name];
      const dateStr = g.date || '2025-01-01';
      return `(${giftId}, ${custId}, 1, '${dateStr}', 'given', ${branchId})`;
    }).join(",\n");
    
    try {
      await pg.query(`
        INSERT INTO gift_distributions (gift_id, customer_id, quantity, distribution_date, status, branch_id)
        VALUES ${values};
      `);
      giftCount += valid.length;
    } catch(e) {}
  }
}
console.log(`  ✓ Imported ${giftCount} gift distributions`);

// ─── 11. Import Lotteries ───────────────────────────────────────────────────

console.log("\n── Importing lotteries...");
let lotteryCount = 0;

// Map committee names to IDs
const committeeNameMap = {};
for (const com of committees) {
  committeeNameMap[com.name] = committeeIdMap[com.idx];
}

for (let i = 0; i < lotteries.length; i += BATCH_SIZE) {
  const batch = lotteries.slice(i, i + BATCH_SIZE);
  const valid = batch.filter(l => committeeNameMap[l.committee_name] && l.date);
  
  if (valid.length > 0) {
    const values = valid.map(l => {
      const comId = committeeNameMap[l.committee_name];
      const dateStr = l.date;
      const status = l.gift_status?.toLowerCase() === 'lucky' ? 'completed' : 'scheduled';
      const notes = l.winner_name ? `Winner: ${l.winner_name} (Token: ${l.token_number || 'N/A'})` : '';
      return `(${comId}, '${dateStr}', ${esc(notes)}, 'gift', 'completed')`;
    }).join(",\n");
    
    try {
      await pg.query(`
        INSERT INTO lotteries (committee_id, draw_date, notes, reward_type, status)
        VALUES ${values};
      `);
      lotteryCount += valid.length;
    } catch(e) {
      // Some may fail due to constraints
    }
  }
}
console.log(`  ✓ Imported ${lotteryCount} lottery records`);

// ─── Done ────────────────────────────────────────────────────────────────────

// Final counts
const counts = await pg.query(`
  SELECT 
    (SELECT count(*) FROM customers) as customers,
    (SELECT count(*) FROM committees) as committees,
    (SELECT count(*) FROM tokens) as tokens,
    (SELECT count(*) FROM committee_members) as members,
    (SELECT count(*) FROM collections) as collections,
    (SELECT count(*) FROM interest_accounts) as interests,
    (SELECT count(*) FROM loans) as loans,
    (SELECT count(*) FROM gift_distributions) as gifts,
    (SELECT count(*) FROM lotteries) as lotteries;
`);

console.log("\n═══════════════════════════════════════════");
console.log("  IMPORT COMPLETE — Final Database Counts:");
console.log("═══════════════════════════════════════════");
console.log(`  Customers:      ${counts.rows[0].customers}`);
console.log(`  Committees:     ${counts.rows[0].committees}`);
console.log(`  Tokens:         ${counts.rows[0].tokens}`);
console.log(`  Members:        ${counts.rows[0].members}`);
console.log(`  Collections:    ${counts.rows[0].collections}`);
console.log(`  Interests:      ${counts.rows[0].interests}`);
console.log(`  Loans:          ${counts.rows[0].loans}`);
console.log(`  Gifts:          ${counts.rows[0].gifts}`);
console.log(`  Lotteries:      ${counts.rows[0].lotteries}`);
console.log("═══════════════════════════════════════════");

await pg.close();
console.log("\n✅ Import complete! You can now start the PGlite server and API.");
process.exit(0);
