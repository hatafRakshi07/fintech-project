import pg from 'pg';
const pool = new pg.Pool({ connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb', ssl:{rejectUnauthorized:false} });
const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='gift_distributions' ORDER BY ordinal_position`);
console.log('gift_distributions cols:', r.rows.map(c=>c.column_name).join(', '));
await pool.end();
