import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectDB() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("Database tables in public schema:");
    for (const r of res.rows) {
      console.log(`- ${r.table_name}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

inspectDB();
