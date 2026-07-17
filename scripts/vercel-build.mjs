/**
 * Vercel Build Script
 * Runs on Vercel's build servers. Builds all packages and prepares output.
 *
 * Output structure expected by vercel.json:
 *   artifacts/api-server/dist/          ← compiled API server (index.mjs)
 *   artifacts/api-server/dist/public/   ← bissi-app static files (outputDirectory)
 *   artifacts/api-server/dist/collector/← collector-app static files
 *   api/index.js                        ← Vercel serverless function
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true, ...opts });
}

console.log('🚀 Starting Vercel build...\n');

// 1. Build shared libraries first
console.log('📦 Building shared libraries...');
run('pnpm --filter @workspace/db build');
run('pnpm --filter @workspace/api-zod build');
run('pnpm --filter @workspace/api-client-react build');

// 2. Build frontend apps
console.log('\n🎨 Building frontend apps...');
run('pnpm --filter bissi-app build');
run('pnpm --filter collector-app build');

// 3. Build the API server
console.log('\n⚙️  Building API server...');
run('node artifacts/api-server/build.mjs', { cwd: ROOT });

// 4. Copy frontend build outputs into API server dist
console.log('\n📁 Copying frontend assets into dist...');
run('node scripts/copy-assets.mjs');

// 5. Verify outputs
const checks = [
  'artifacts/api-server/dist/index.mjs',
  'artifacts/api-server/dist/public/index.html',
];

let allGood = true;
for (const f of checks) {
  const full = resolve(ROOT, f);
  if (existsSync(full)) {
    console.log(`  ✅ ${f}`);
  } else {
    console.error(`  ❌ MISSING: ${f}`);
    allGood = false;
  }
}

if (!allGood) {
  console.error('\n❌ Build verification failed!');
  process.exit(1);
}

console.log('\n✅ Vercel build complete!');
