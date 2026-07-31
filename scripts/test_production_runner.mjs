import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

async function testProductionAudit() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
  const client = new Client({ connectionString });

  try {
    const ddlPath = path.resolve('scripts/bissi_enterprise_schema.sql');
    const testPath = path.resolve('scripts/test_production_suite.sql');

    const ddlSql = fs.readFileSync(ddlPath, 'utf8');
    const testSql = fs.readFileSync(testPath, 'utf8');

    console.log(`Read DDL schema (${ddlSql.length} bytes) and Test Suite (${testSql.length} bytes)`);
    await client.connect();
    console.log('Connected to PostgreSQL! Executing v5.1 Final Frozen DDL Schema...');

    await client.query(ddlSql);
    console.log('SUCCESS: DDL Schema executed cleanly with ZERO ERRORS!');

    console.log('Executing Production Test Suite script...');
    await client.query(testSql);
    await client.query('SELECT fn_run_production_test_suite();');
    console.log('SUCCESS: All automated production test assertions PASSED WITH ZERO ERRORS!');
  } catch (err) {
    console.error('SQL Audit & Production Test Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testProductionAudit();
