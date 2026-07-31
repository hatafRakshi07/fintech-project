import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    console.log("=== APPLYING USER SPECIFIC TOKEN & CUSTOMER FIXES ===");

    // 1. Sawariya Seth Bissi (ID 1) - Token 443 split into 443a and 443b
    console.log("\n1. Fixing Token 443 -> 443a and 443b in Sawariya Seth Bissi...");
    
    // Check if token 443 exists
    const t443 = await pool.query("SELECT id, customer_id FROM tokens WHERE committee_id = 1 AND (token_number = '443' OR token_number = '443a') LIMIT 2");
    if (t443.rows.length > 0) {
      await pool.query("UPDATE tokens SET token_number = '443a' WHERE id = $1", [t443.rows[0].id]);
      await pool.query("UPDATE committee_members SET token_number = '443a' WHERE committee_id = 1 AND customer_id = $1", [t443.rows[0].customer_id]);
    }
    
    // Ensure second token is 443b
    const resCust = await pool.query("SELECT id FROM customers WHERE name LIKE '%443%' OR id NOT IN (SELECT customer_id FROM tokens WHERE committee_id = 1 AND token_number = '443a') LIMIT 1");
    const cust443bId = resCust.rows[0]?.id || 2;
    await pool.query(`
      INSERT INTO tokens (token_number, committee_id, customer_id, status, created_at)
      VALUES ('443b', 1, $1, 'active', NOW())
      ON CONFLICT DO NOTHING
    `, [cust443bId]);
    await pool.query(`
      INSERT INTO committee_members (committee_id, customer_id, token_number, status, joined_at)
      VALUES (1, $1, '443b', 'active', NOW())
      ON CONFLICT DO NOTHING
    `, [cust443bId]);
    console.log("  Token 443a and 443b set in Sawariya Seth Bissi.");

    // 2. Sawariya Seth Bissi (ID 1) - Token 311 set to Suraj Parwani Ji (9594486326)
    console.log("\n2. Updating Token 311 in Sawariya Seth to Suraj Parwani Ji (9594486326)...");
    
    // Upsert customer Suraj Parwani Ji
    let surajId;
    const cSuraj = await pool.query("SELECT id FROM customers WHERE mobile = '9594486326' OR name LIKE '%Suraj Parwani%' LIMIT 1");
    if (cSuraj.rows.length > 0) {
      surajId = cSuraj.rows[0].id;
      await pool.query("UPDATE customers SET name = 'Suraj Parwani Ji', mobile = '9594486326' WHERE id = $1", [surajId]);
    } else {
      const insSuraj = await pool.query(`
        INSERT INTO customers (name, mobile, reference_number, branch_id, status, created_at, updated_at)
        VALUES ('Suraj Parwani Ji', '9594486326', 'REF-SURAJ311', 1, 'active', NOW(), NOW())
        RETURNING id
      `);
      surajId = insSuraj.rows[0].id;
    }

    // Update Token 311 in Committee 1 to surajId
    await pool.query("UPDATE tokens SET customer_id = $1 WHERE committee_id = 1 AND token_number = '311'", [surajId]);
    await pool.query("UPDATE committee_members SET customer_id = $1 WHERE committee_id = 1 AND token_number = '311'", [surajId]);
    console.log("  Token 311 updated to Suraj Parwani Ji (9594486326).");

    // 3. Shree Krishna Bissi (ID 4) - Token 29 1/2 -> Token 29
    console.log("\n3. Updating Token '29 1/2' -> '29' in Shree Krishna Bissi...");
    await pool.query("UPDATE tokens SET token_number = '29' WHERE committee_id = 4 AND (token_number = '29 1/2' OR token_number = '29.5')");
    await pool.query("UPDATE committee_members SET token_number = '29' WHERE committee_id = 4 AND (token_number = '29 1/2' OR token_number = '29.5')");
    console.log("  Token '29 1/2' updated to '29'.");

    // 4. Update Unknown 1, Unknown 2, Unknown 3 for customers with missing/jsk/blank names
    console.log("\n4. Cleaning up blank/jsk names to Unknown 1, 2, 3...");
    const unknownCusts = await pool.query(`
      SELECT id, name FROM customers 
      WHERE LOWER(name) IN ('jsk', 'name', 'none', 'unknown', '', '-') 
         OR name LIKE 'Member #%' 
      ORDER BY id ASC
    `);

    console.log(`  Found ${unknownCusts.rows.length} customers to rename to Unknown 1, 2, 3...`);
    let idx = 1;
    for (const row of unknownCusts.rows) {
      await pool.query("UPDATE customers SET name = $1 WHERE id = $2", [`Unknown ${idx}`, row.id]);
      idx++;
    }
    console.log("  Cleaned up all unknown customer names.");

    console.log("\n=== ALL FIXES APPLIED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("Error applying fixes:", err.message);
  } finally {
    await pool.end();
  }
}

main();
