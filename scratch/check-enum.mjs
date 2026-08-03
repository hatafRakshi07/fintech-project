import pg from 'pg';
const pool = new pg.Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'});
const r = await pool.query("SELECT id, email, role FROM users LIMIT 5");
console.log("users:", r.rows);
const r2 = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='office_diary' ORDER BY ordinal_position");
console.log("\noffice_diary schema:");
for (const c of r2.rows) console.log(`  ${c.column_name}: ${c.data_type} nullable=${c.is_nullable}`);
await pool.end();
