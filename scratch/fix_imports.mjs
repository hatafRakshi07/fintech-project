import fs from 'fs';
import path from 'path';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === 'dist') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (/\.(tsx?|jsx?|json|md)$/.test(file)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('@/pages')) {
        content = content.replace(/@\/pages\b/g, '@/views');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated:', fullPath);
      }
    }
  }
}

walk('c:/Users/iSN_kota_T52/Desktop/fintech-project/artifacts/bissi-app');
