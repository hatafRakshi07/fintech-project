import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kyc_verifications (
      id SERIAL PRIMARY KEY,
      user_id INT,
      customer_id INT,
      user_role VARCHAR(50) DEFAULT 'customer',
      user_name VARCHAR(255),
      user_mobile VARCHAR(20),
      aadhaar_number VARCHAR(20),
      aadhaar_front_url TEXT,
      aadhaar_back_url TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      rejection_reason TEXT,
      submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      reviewed_at TIMESTAMP WITH TIME ZONE,
      reviewed_by INT
    );
  `);
  console.log("Successfully created kyc_verifications table!");
  await pool.end();
}

main().catch(err => {
  console.error("Error creating KYC table:", err);
  pool.end();
});
