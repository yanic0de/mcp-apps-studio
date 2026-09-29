import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { mcpAppsStudio } from '../../packages/cli/src/vite-plugin.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const TOKEN = 'd'.repeat(32);
const PORT = 4497;
const VITE_PORT = 5196;
const STUDIO = `http://127.0.0.1:${PORT}/?token=${TOKEN}`;

/** Vanilla widget: SDK handshake, renders `structuredContent.msg` of the pushed tool result. */
const WIDGET = `<!doctype html><html><body><p id="msg">waiting</p><script>
  let id = 0; const pending = new Map();
  const request = (method, params) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve);
    parent.postMessage({ jsonrpc: '2.0', id: i, method, params }, '*'); });
  addEventListener('message', (ev) => { const m = ev.data;
    if (m && m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    if (m && m.method === 'ui/notifications/tool-result') document.getElementById('msg').textContent = m.params.structuredContent.msg; });
  request('ui/initialize', { protocolVersion: '2026-01-26', appInfo: { name: 'w', version: '1' }, appCapabilities: {} })
    .then(() => parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*'));
</script><span id="rev">REV</span></body></html>`;

const story = (widget: string, msg: string) =>
  `export default { title: 'W', widget: ${JSON.stringify(widget)}, scenarios: { default: { toolCall: { name: 't', result: { kind: 'static', structuredContent: { msg: ${JSON.stringify(msg)} } } } } } };\n`;

let project: string;
let devRoot: string; // outside the watched project: proves Vite's own HMR, not the studio's live reload
let cli: ChildProcess;
let vite: ViteDevServer;

test.beforeAll(async () => {
  project = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-loop-'));
  await fs.mkdir(path.join(project, 'widgets'));
  await fs.writeFile(path.join(project, 'widgets', 'w.html'), WIDGET.replace('REV', 'file'));
  await fs.writeFile(path.join(project, 'widgets', 'w.stories.mcp.ts'), story('./w.html', 'one'));
  await fs.writeFile(path.join(project, 'widgets', 'broken.stories.mcp.ts'), `export default { title: 'B' };\n`);

  // A real Vite dev server with the plugin, serving the same widget for the dev-URL story.
  devRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-widget-'));
  await fs.writeFile(path.join(devRoot, 'index.html'), WIDGET.replace('REV', 'dev-v1'));
  vite = await createServer({
    root: devRoot,
    configFile: false,
    logLevel: 'silent',
    server: { port: VITE_PORT, strictPort: true },
    plugins: [mcpAppsStudio()],
  });
  await vite.listen();
  await fs.writeFile(path.join(project, 'dev.stories.mcp.ts'), story(`http://localhost:${VITE_PORT}/`, 'from-dev'));

  cli = spawn('pnpm', ['-F', 'mcp-apps-studio', 'start', '--port', String(PORT), '--token', TOKEN, project], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    if (
      await fetch(STUDIO).then(
        (r) => r.ok,
        () => false,
      )
    )
      return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('CLI did not start');
});

test.afterAll(async () => {
  cli?.kill();
  await vite?.close();
  await fs.rm(project, { recursive: true, force: true });
  await fs.rm(devRoot, { recursive: true, force: true });
});

const frame = (page: import('@playwright/test').Page) => page.frameLocator('iframe[title="widget under test"]');

test('editing a story updates the open studio; a broken story is reported, not fatal', async ({ page }) => {
  await page.goto(`${STUDIO}&widget=w`);
  await expect(frame(page).locator('#msg')).toHaveText('one');
  await expect(page.getByRole('alert')).toContainText('broken.stories.mcp.ts');

  await fs.writeFile(path.join(project, 'widgets', 'w.stories.mcp.ts'), story('./w.html', 'two'));
  await expect(frame(page).locator('#msg')).toHaveText('two', { timeout: 10_000 });
  await expect(page.getByLabel('Widget')).toHaveValue('w');
});

test('a dev-server widget runs in the null-origin sandbox and hot-reloads', async ({ page }) => {
  // Vite's HMR client connects after the page loads; an edit before that is never pushed (a CI race).
  const hmrConnected = page.waitForEvent('console', { predicate: (m) => m.text().includes('[vite] connected') });
  await page.goto(`${STUDIO}&widget=dev`);
  await expect(page.locator('iframe[title="widget under test"]')).toHaveAttribute(
    'src',
    `http://localhost:${VITE_PORT}/`,
  );
  await expect(frame(page).locator('#msg')).toHaveText('from-dev');
  await expect(frame(page).locator('#rev')).toHaveText('dev-v1');
  await hmrConnected;

  await fs.writeFile(path.join(devRoot, 'index.html'), WIDGET.replace('REV', 'dev-v2'));
  await expect(frame(page).locator('#rev')).toHaveText('dev-v2', { timeout: 10_000 });
  // Vite reloaded the frame; the new view instance handshakes again and the host replays the tool call
  await expect(frame(page).locator('#msg')).toHaveText('from-dev');
});
