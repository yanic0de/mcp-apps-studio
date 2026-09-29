// Copies the built studio SPA and the component registry next to the bundled CLI (see src/assets.ts).
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dist = path.join(import.meta.dirname, '..', 'dist');
const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

const studio = path.join(pkgDir('@studio/app'), 'dist');
try {
  await fs.access(path.join(studio, 'index.html'));
} catch {
  console.error('Studio build not found. Run: pnpm -F @studio/app build');
  process.exit(1);
}
await fs.cp(studio, path.join(dist, 'studio'), { recursive: true });

const components = pkgDir('@studio/components');
const registry = JSON.parse(await fs.readFile(path.join(components, 'registry.json'), 'utf8'));
for (const item of registry.items) {
  for (const file of item.files) {
    await fs.mkdir(path.dirname(path.join(dist, 'registry', file)), { recursive: true });
    await fs.copyFile(path.join(components, file), path.join(dist, 'registry', file));
  }
}
await fs.writeFile(path.join(dist, 'registry', 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
console.log('copied studio + registry into dist/');
