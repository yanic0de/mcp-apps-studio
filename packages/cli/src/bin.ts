#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { discoverStories } from './discover.js';
import { createStudioServer, generateToken } from './server.js';

const args = process.argv.slice(2);
let port = 4400;
let rootDir = process.cwd();

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--port') {
    port = Number(args[++i]);
    if (!Number.isInteger(port) || port <= 0) {
      console.error('Invalid --port value');
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

const token = generateToken();
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
