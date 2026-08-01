import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  const bissiDistPublic = path.join(root, 'artifacts', 'bissi-app', 'dist', 'public');
  const bissiDist = path.join(root, 'artifacts', 'bissi-app', 'dist');
  const bissiOut = path.join(root, 'artifacts', 'bissi-app', 'out');

  const bissiHasDistPublic = await fs.stat(bissiDistPublic).then(s => s.isDirectory()).catch(() => false);
  const bissiHasDist = await fs.stat(bissiDist).then(s => s.isDirectory()).catch(() => false);

  const bissiSrc = bissiHasDistPublic ? bissiDistPublic : bissiHasDist ? bissiDist : bissiOut;
  const bissiDest = path.join(root, 'artifacts', 'api-server', 'dist', 'public');

  const collectorSrc = path.join(root, 'artifacts', 'collector-app', 'dist');
  const collectorDest = path.join(root, 'artifacts', 'api-server', 'dist', 'collector');

  console.log('Copying bissi-app assets...');
  try {
    await copyDir(bissiSrc, bissiDest);
    console.log('Successfully copied bissi-app assets.');
  } catch (err) {
    console.error('Failed to copy bissi-app assets:', err.message);
  }

  console.log('Copying collector-app assets...');
  try {
    await copyDir(collectorSrc, collectorDest);
    console.log('Successfully copied collector-app assets.');
  } catch (err) {
    console.error('Failed to copy collector-app assets:', err.message);
  }
}

main();
