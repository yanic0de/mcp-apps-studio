#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { addComponent, listComponents } from './add.js';
import { discoverStories } from './discover.js';
import { createStudioServer, generateToken } from './server.js';

const args = process.argv.slice(2);

if (args[0] === 'add') {
  const name = args[1];
  if (!name || name.startsWith('-')) {
    console.error('Usage: mcp-apps-studio add <component> [--dir <dir>]');
    console.error(`Available: ${(await listComponents()).map((i) => i.name).join(', ')}`);
    process.exit(1);
  }
  const dirFlag = args.indexOf('--dir');
  const dir = dirFlag !== -1 ? (args[dirFlag + 1] ?? 'src/components') : 'src/components';
  const copied = await addComponent(name, path.resolve(process.cwd(), dir));
  console.log(`Added "${name}":`);
  for (const file of copied) console.log(`  ${path.relative(process.cwd(), file)}`);
  console.log('\nComponent uses @studio/widget-runtime — add it to your dependencies.');
  process.exit(0);
}

let port = 4400;
let rootDir = process.cwd();
let fixedToken: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--port') {
    port = Number(args[++i]);
    if (!Number.isInteger(port) || port <= 0) {
      console.error('Invalid --port value');
      process.exit(1);
    }
  } else if (arg === '--token') {
    // Explicit token for automation (e2e); default stays a fresh random token.
    fixedToken = args[++i];
    if (!fixedToken) {
      console.error('Invalid --token value');
      process.exit(1);
    }
  } else if (arg && !arg.startsWith('-')) {
    rootDir = path.resolve(arg);
  }
}

const require = createRequire(import.meta.url);
const studioDist = path.join(path.dirname(require.resolve('@studio/app/package.json')), 'dist');
if (!fs.existsSync(path.join(studioDist, 'index.html'))) {
  console.error('Studio build not found. Run: pnpm -F @studio/app build');
  process.exit(1);
}

const manifest = await discoverStories(rootDir);
if (manifest.length === 0) {
  console.log(`No *.stories.mcp.ts found under ${rootDir} — studio will show the built-in demo widget.`);
}

const token = fixedToken ?? generateToken();
const server = createStudioServer({ studioDist, manifest, token });

// localhost only + one-time token in URL: a local dev tool is still an attack surface.
server.listen(port, '127.0.0.1', () => {
  console.log('');
  console.log('  MCP Apps Studio');
  console.log(`  project: ${rootDir}`);
  console.log(`  widgets: ${manifest.length}`);
  console.log('');
  console.log(`  → http://127.0.0.1:${port}/?token=${token}`);
  console.log('');
});
