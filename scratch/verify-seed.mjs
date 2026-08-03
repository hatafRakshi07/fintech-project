import pg from 'pg';
const pool = new pg.Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'});

// Token counts per scheme
const tokens = await pool.query(`
  SELECT c.name as scheme, COUNT(t.id) as token_count, 
         SUM(CASE WHEN t.status='OUT' THEN 1 ELSE 0 END) as lucky_count
  FROM tokens t JOIN committees c ON t.committee_id = c.id
  GROUP BY c.name ORDER BY c.name
`);
console.log("\n=== TOKENS PER SCHEME ===");
console.table(tokens.rows);

// Collection counts and totals per scheme
const cols = await pool.query(`
  SELECT c.name as scheme, COUNT(col.id) as collection_count, 
         SUM(col.amount) as total_collected
  FROM collections col JOIN committees c ON col.committee_id::text = c.code
  GROUP BY c.name ORDER BY c.name
`);

// Try alternate join
const cols2 = await pool.query(`
  SELECT committee_id, COUNT(id) as collection_count, SUM(amount) as total_collected
  FROM collections GROUP BY committee_id ORDER BY committee_id
`);
console.log("\n=== COLLECTIONS PER COMMITTEE_ID ===");
console.table(cols2.rows);

// Sample collections
const sample = await pool.query(`SELECT committee_id, customer_id, amount, collected_at, notes FROM collections LIMIT 5`);
console.log("\n=== SAMPLE COLLECTIONS ===");
console.table(sample.rows);

// Lotteries
const lotteries = await pool.query(`SELECT * FROM lotteries LIMIT 5`);
console.log("\n=== LOTTERIES ===");
console.table(lotteries.rows);

await pool.end();
