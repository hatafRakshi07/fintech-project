/**
 * push-schema-to-neon.mjs
 * 
 * Runs the Drizzle migrations against any PostgreSQL database (Neon, Supabase, etc.)
 * Usage:
 *   node push-schema-to-neon.mjs <DATABASE_URL>
 *   OR set DATABASE_URL env var and run:
 *   DATABASE_URL="postgresql://..." node push-schema-to-neon.mjs
 */

import { execSync } from 'child_process';

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('\n❌ No DATABASE_URL provided!');
  console.error('\nUsage:');
  console.error('  node push-schema-to-neon.mjs "postgresql://user:pass@host/dbname"');
  console.error('\nOr set the environment variable:');
  console.error('  $env:DATABASE_URL="postgresql://..."; node push-schema-to-neon.mjs');
  process.exit(1);
}

console.log('🔗 Connecting to database...');
console.log(`   ${DATABASE_URL.replace(/:([^@]+)@/, ':***@')}`); // Hide password in log

// Run drizzle-kit push which applies schema to the target database
try {
  execSync(
    `node .node/pnpm.cmd --filter @workspace/db db:push`,
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, DATABASE_URL },
    }
  );
  console.log('\n✅ Schema pushed successfully to cloud database!');
  console.log('\n📌 Next steps:');
  console.log('   1. Go to https://vercel.com → Your Project → Settings → Environment Variables');
  console.log('   2. Add: DATABASE_URL = ' + DATABASE_URL.replace(/:([^@]+)@/, ':***@'));
  console.log('   3. Deploy!');
} catch (err) {
  console.error('\n❌ Schema push failed:', err.message);
  process.exit(1);
}
