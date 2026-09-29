#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { addComponent, listComponents, UnknownComponentError } from './add.js';
import { CliError, type Command, parseCli } from './args.js';
import { locateAssets, requireStudioDist } from './assets.js';
import { discoverStories } from './discover.js';
import { findWidgetFiles, initStories } from './init.js';
import { resolveProjectDir } from './project-dir.js';
import { createStudioServer, generateToken, listenLoopback, PortInUseError } from './server.js';
import { summarize } from './test-plan.js';
import { NoBrowserError, runStoryTests } from './test-runner.js';
import { watchProject } from './watcher.js';

type Of<N extends Command['name']> = Extract<Command, { name: N }>;

const require = createRequire(import.meta.url);
const rel = (file: string) => path.relative(process.cwd(), file);

async function add(cmd: Of<'add'>): Promise<number> {
  const available = async () => (await listComponents()).map((i) => i.name).join(', ');
  if (!cmd.component) throw new CliError(`add needs a component name. Available: ${await available()}`);
  let added: Awaited<ReturnType<typeof addComponent>>;
  try {
    added = await addComponent(cmd.component, path.resolve(cmd.dir), { force: cmd.force });
  } catch (err) {
    if (err instanceof UnknownComponentError) throw new CliError(err.message);
    throw err;
  }
  if (added.copied.length > 0) console.log(`Added "${cmd.component}":`);
  for (const file of added.copied) console.log(`  ${rel(file)}`);
  if (added.skipped.length > 0) {
    console.log('Skipped (already there, keeping your version; --force replaces):');
    for (const file of added.skipped) console.log(`  ${rel(file)}`);
  }
  console.log('\nComponent uses @mcp-apps-studio/widget-runtime. Install it with its peers:');
  console.log(
    '  npm i @mcp-apps-studio/widget-runtime @modelcontextprotocol/ext-apps @modelcontextprotocol/client zod react react-dom',
  );
  return 0;
}

function installBrowser(cmd: Of<'install-browser'>): number {
  // Chromium matching the bundled playwright-core (a plain `npx playwright install` may fetch another build).
  const cli = path.join(path.dirname(require.resolve('playwright-core/package.json')), 'cli.js');
  const extra = cmd.withDeps ? ['--with-deps'] : [];
  const result = spawnSync(process.execPath, [cli, 'install', ...extra, 'chromium'], { stdio: 'inherit' });
  return result.status ?? 1;
}

async function init(cmd: Of<'init'>): Promise<number> {
  const root = process.cwd();
  const files = cmd.files.map((f) => path.resolve(f));
  const widgets = files.length > 0 ? files : await findWidgetFiles(root);
  if (widgets.length === 0) {
    throw new CliError('no MCP Apps widget HTML found. Pass the file: mcp-apps-studio init path/to/widget.html');
  }
  const { created, skipped } = await initStories(root, widgets, { tool: cmd.tool });
  for (const f of created) console.log(`  + ${path.relative(root, f)}`);
  for (const f of skipped) console.log(`  = ${path.relative(root, f)} (exists, left untouched)`);
  console.log(
    '\nNext: set the tool name and data in the story, then run `mcp-apps-studio` (studio) or `mcp-apps-studio test` (CI).',
  );
  return 0;
}

async function test(cmd: Of<'test'>): Promise<number> {
  const dir = resolveProjectDir(cmd.dir);
  const out = path.resolve(cmd.out);
  const snapshots = {
    dir: path.resolve(dir, cmd.snapshots ?? 'mcp-studio-snapshots'),
    update: cmd.updateSnapshots,
    threshold: cmd.threshold,
    maxDiffPixels: cmd.maxDiffPixels,
  };
  try {
    const { results, errors } = await runStoryTests({
      rootDir: dir,
      studioDist: requireStudioDist(locateAssets()),
      outDir: out,
      themes: cmd.themes,
      snapshots,
    });
    if (cmd.updateSnapshots) console.log(`Baselines written to ${snapshots.dir}`);
    console.log(summarize(results));
    for (const e of errors) {
      console.error(`\n  ✗ story failed to load: ${path.relative(dir, e.file)}\n      ${e.message}`);
    }
    console.log(`\nReport: ${path.join(out, 'report.html')}`);
    return results.every((r) => r.ok) && errors.length === 0 ? 0 : 1;
  } catch (err) {
    if (!(err instanceof NoBrowserError)) throw err;
    console.error(`No Chromium for headless runs: ${err.message.split('\n')[0]}`);
    console.error('Install it once with: npx mcp-apps-studio install-browser');
    return 2;
  }
}

/** Serves the studio until the process is stopped; resolves once it listens. */
async function start(cmd: Of<'start'>): Promise<void> {
  const rootDir = resolveProjectDir(cmd.dir);
  const studioDist = requireStudioDist(locateAssets());
  const manifest = await discoverStories(rootDir);
  for (const e of manifest.errors)
    console.warn(`Story failed to load: ${path.relative(rootDir, e.file)} — ${e.message}`);
  if (manifest.widgets.length === 0) {
    console.log(`No *.stories.mcp.ts found under ${rootDir} — studio will show the built-in demo widget.`);
  }

  // localhost only + one-time token in URL: a local dev tool is still an attack surface.
  const token = cmd.token ?? generateToken();
  // Rediscover per request; the watcher tells open studios to refetch (live reload).
  const server = createStudioServer({ studioDist, getManifest: () => discoverStories(rootDir), token });
  const port = await listenLoopback(server, cmd.port);
  watchProject(rootDir, () => server.notify('manifest'));
  console.log('');
  console.log('  MCP Apps Studio');
  console.log(`  project: ${rootDir}`);
  console.log(
    `  widgets: ${manifest.widgets.length}${manifest.errors.length ? ` (${manifest.errors.length} failed to load)` : ''}`,
  );
  console.log('');
  console.log(`  → http://127.0.0.1:${port}/?token=${token}`);
  console.log('');
}

async function main(): Promise<number | undefined> {
  const cli = parseCli(process.argv.slice(2));
  switch (cli.kind) {
    case 'help':
      console.log(cli.text);
      return 0;
    case 'version':
      console.log((require('../package.json') as { version: string }).version);
      return 0;
    case 'error':
      throw new CliError(`${cli.message} (see mcp-apps-studio --help)`);
  }
  const cmd = cli.command;
  switch (cmd.name) {
    case 'add':
      return add(cmd);
    case 'install-browser':
      return installBrowser(cmd);
    case 'init':
      return init(cmd);
    case 'test':
      return test(cmd);
    case 'start':
      await start(cmd);
      return undefined; // keep serving
  }
}

main().then(
  (code) => {
    if (code !== undefined) process.exit(code);
  },
  (err: unknown) => {
    // Expected failures are one line; anything else too, with the stack only when debugging.
    const known = err instanceof CliError || err instanceof PortInUseError;
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    if (!known && process.env.MCP_APPS_STUDIO_DEBUG === '1' && err instanceof Error) console.error(err.stack);
    process.exit(1);
  },
);
