import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const TOKEN = 'r'.repeat(32);
const PORT = 4496;
const STUDIO = `http://127.0.0.1:${PORT}/?token=${TOKEN}`;

/** Vanilla widget: after the handshake it asks the host to open a link and to send a message; it answers teardown. */
const WIDGET = `<!doctype html><html><body><p>requests</p><script>
  let id = 0; const pending = new Map();
  const request = (method, params) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve);
    parent.postMessage({ jsonrpc: '2.0', id: i, method, params }, '*'); });
  addEventListener('message', (ev) => { const m = ev.data;
    if (m && m.method === 'ui/resource-teardown') parent.postMessage({ jsonrpc: '2.0', id: m.id, result: {} }, '*');
    else if (m && m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  request('ui/initialize', { protocolVersion: '2026-01-26', appInfo: { name: 'r', version: '1' }, appCapabilities: {} })
    .then(() => parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*'))
    .then(() => request('ui/open-link', { url: 'https://example.com/docs' }))
    .then(() => request('ui/message', { role: 'user', content: [{ type: 'text', text: 'Summarize this' }] }));
</script></body></html>`;

let project: string;
let cli: ChildProcess;

test.beforeAll(async () => {
  project = await fs.mkdtemp(path.join(os.tmpdir(), 'host-requests-'));
  await fs.writeFile(path.join(project, 'r.html'), WIDGET);
  await fs.writeFile(
    path.join(project, 'r.stories.mcp.ts'),
    `export default { title: 'R', widget: './r.html', scenarios: { default: {}, other: {} } };\n`,
  );
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
  await fs.rm(project, { recursive: true, force: true });
});

test('widget requests are listed; only http(s) links are clickable, and they open safely', async ({ page }) => {
  await page.goto(STUDIO);
  const panel = page.getByRole('region', { name: 'Widget requests' });
  const link = panel.getByRole('link', { name: 'https://example.com/docs' });
  await expect(link).toHaveAttribute('href', 'https://example.com/docs');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(panel).toContainText('Message');
  await expect(panel).toContainText('Summarize this');
});

test('switching the scenario tears the previous widget down first, and the widget receives it', async ({ page }) => {
  await page.goto(STUDIO);
  await expect(page.getByRole('region', { name: 'Widget requests' })).toContainText('Summarize this');
  await page.getByLabel('Scenario').selectOption('other');
  await expect(page.locator('.trace-row').filter({ hasText: 'ui/resource-teardown' })).toHaveCount(1);
  // The answer proves delivery: a request sent to an already removed frame would only time out.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const log = window.__mcpStudio?.getLog() ?? [];
        const req = log.find((e) => e.method === 'ui/resource-teardown');
        return log.some((e) => e.direction === 'widget→host' && e.kind === 'response' && e.id === req?.id);
      }),
    )
    .toBe(true);
  // Only the new widget stays visible and addressable.
  await expect(page.locator('iframe[title="widget under test"]')).toHaveCount(1);
});
