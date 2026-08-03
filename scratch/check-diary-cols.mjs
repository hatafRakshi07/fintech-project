import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',ssl:{rejectUnauthorized:false}});
const r = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='daily_diary_payments' ORDER BY ordinal_position");
console.log('daily_diary_payments cols:', r.rows.map(x=>x.column_name).join(', '));
await p.end();
