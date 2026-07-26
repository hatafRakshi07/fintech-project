import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  // Force IPv4
  if (client.connectionParameters) {
    client.connectionParameters.family = 4;
  }

  try {
    console.log("Connecting to Supabase (IPv4)...");
    await client.connect();
    console.log("Connected.");

    console.log("1. Dropping old public schema...");
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;');
    console.log("Old schema dropped.");

    console.log("2. Applying new migration...");
    const migrationDir = path.resolve(__dirname, '../lib/db/drizzle');
    const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql'));
    
    // Sort logically so 0000_ is first
    files.sort();
    
    const targetFile = files[0];
    if (!targetFile) throw new Error("No SQL file found in drizzle directory");
    
    console.log("Found migration:", targetFile);
    const sqlContent = fs.readFileSync(path.join(migrationDir, targetFile), 'utf-8');
    
    await client.query(sqlContent);
    console.log("Migration applied successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
