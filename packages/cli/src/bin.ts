#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { addComponent, listComponents } from './add.js';
import { locateAssets } from './assets.js';
import { discoverStories } from './discover.js';
import { findWidgetFiles, initStories } from './init.js';
import { createStudioServer, generateToken } from './server.js';
import { summarize, type Theme } from './test-plan.js';
import { NoBrowserError, runStoryTests } from './test-runner.js';
import { watchProject } from './watcher.js';

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
  console.log('\nComponent uses @mcp-apps-studio/widget-runtime. Install it with its peers:');
  console.log(
    '  npm i @mcp-apps-studio/widget-runtime @modelcontextprotocol/ext-apps @modelcontextprotocol/client zod react react-dom',
  );
  process.exit(0);
}

function resolveStudioDist(): string {
  const dist = locateAssets().studioDist;
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('Studio build not found. Run: pnpm -F @studio/app build');
    process.exit(1);
  }
  return dist;
}

if (args[0] === 'install-browser') {
  // Chromium matching the bundled playwright-core (a plain `npx playwright install` may fetch another build).
  const require = createRequire(import.meta.url);
  const cli = path.join(path.dirname(require.resolve('playwright-core/package.json')), 'cli.js');
  const extra = args.includes('--with-deps') ? ['--with-deps'] : [];
  const result = spawnSync(process.execPath, [cli, 'install', ...extra, 'chromium'], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

if (args[0] === 'init') {
  const root = process.cwd();
  let tool: string | undefined;
  const files: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tool') tool = args[++i];
    else if (arg && !arg.startsWith('-')) files.push(path.resolve(arg));
  }
  const widgets = files.length > 0 ? files : await findWidgetFiles(root);
  if (widgets.length === 0) {
    console.error('No MCP Apps widget HTML found. Pass the file: mcp-apps-studio init path/to/widget.html');
    process.exit(1);
  }
  const { created, skipped } = await initStories(root, widgets, { tool });
  for (const f of created) console.log(`  + ${path.relative(root, f)}`);
  for (const f of skipped) console.log(`  = ${path.relative(root, f)} (exists, left untouched)`);
  console.log(
    '\nNext: set the tool name and data in the story, then run `mcp-apps-studio` (studio) or `mcp-apps-studio test` (CI).',
  );
  process.exit(0);
}

if (args[0] === 'test') {
  let dir = process.cwd();
  let outDir = '.mcp-studio/test';
  let themes: Theme[] = ['light', 'dark'];
  let snapshotsDir: string | undefined;
  let update = false;
  let threshold = 0.1;
  let maxDiffPixels = 0;
  const number = (flag: string, value: string | undefined, max = Number.POSITIVE_INFINITY) => {
    const n = Number(value);
    if (value === undefined || !Number.isFinite(n) || n < 0 || n > max) {
      console.error(`Invalid ${flag} value`);
      process.exit(1);
    }
    return n;
  };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--update-snapshots') update = true;
    else if (arg === '--snapshots') snapshotsDir = args[++i];
    else if (arg === '--threshold') threshold = number('--threshold', args[++i], 1);
    else if (arg === '--max-diff-pixels') maxDiffPixels = Math.floor(number('--max-diff-pixels', args[++i]));
    else if (arg === '--out') outDir = args[++i] ?? outDir;
    else if (arg === '--themes') {
      const list = (args[++i] ?? '').split(',').filter(Boolean);
      if (list.length === 0 || list.some((t) => t !== 'light' && t !== 'dark')) {
        console.error('Invalid --themes value (use light,dark)');
        process.exit(1);
      }
      themes = list as Theme[];
    } else if (arg && !arg.startsWith('-')) dir = path.resolve(arg);
  }
  const out = path.resolve(outDir);
  try {
    const snapshots = {
      dir: path.resolve(dir, snapshotsDir ?? 'mcp-studio-snapshots'),
      update,
      threshold,
      maxDiffPixels,
    };
    const { results, errors } = await runStoryTests({
      rootDir: dir,
      studioDist: resolveStudioDist(),
      outDir: out,
      themes,
      snapshots,
    });
    if (update) console.log(`Baselines written to ${snapshots.dir}`);
    console.log(summarize(results));
    for (const e of errors)
      console.error(`\n  ✗ story failed to load: ${path.relative(dir, e.file)}\n      ${e.message}`);
    console.log(`\nReport: ${path.join(out, 'report.html')}`);
    process.exit(results.every((r) => r.ok) && errors.length === 0 ? 0 : 1);
  } catch (err) {
    if (err instanceof NoBrowserError) {
      console.error(`No Chromium for headless runs: ${err.message.split('\n')[0]}`);
      console.error('Install it once with: npx mcp-apps-studio install-browser');
      process.exit(2);
    }
    throw err;
  }
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

const studioDist = resolveStudioDist();

const manifest = await discoverStories(rootDir);
for (const e of manifest.errors) console.warn(`Story failed to load: ${path.relative(rootDir, e.file)} — ${e.message}`);
if (manifest.widgets.length === 0) {
  console.log(`No *.stories.mcp.ts found under ${rootDir} — studio will show the built-in demo widget.`);
}

const token = fixedToken ?? generateToken();
// Rediscover per request; the watcher tells open studios to refetch (live reload).
const server = createStudioServer({ studioDist, getManifest: () => discoverStories(rootDir), token });
watchProject(rootDir, () => server.notify('manifest'));

// localhost only + one-time token in URL: a local dev tool is still an attack surface.
server.listen(port, '127.0.0.1', () => {
  console.log('');
  console.log('  MCP Apps Studio');
  console.log(`  project: ${rootDir}`);
  console.log(
    `  widgets: ${manifest.widgets.length}${manifest.errors.length ? ` (${manifest.errors.length} failed to load)` : ''}`,
  );
  console.log('');
  console.log(`  → http://127.0.0.1:${port}/?token=${token}`);
  console.log('');
});
