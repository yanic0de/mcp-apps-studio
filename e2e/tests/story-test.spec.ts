import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

test('deep link opens a scenario and theme; the automation hook exposes the trace', async ({ page }) => {
  await page.goto('/?scenario=error&theme=dark');
  await expect(page.getByLabel('Scenario')).toHaveValue('error');
  await expect(page.getByLabel('Theme')).toHaveValue('dark');
  const frame = page.frameLocator('iframe[title="widget under test"]');
  await expect(frame.locator('#status')).toContainText('Metrics backend unavailable');
  const methods = await page.evaluate(() => window.__mcpStudio?.getLog().map((e) => e.method) ?? []);
  expect(methods).toContain('ui/initialize');
});

test('`mcp-apps-studio test` passes on the component library and writes a report with screenshots', async () => {
  test.setTimeout(120_000);
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'story-test-'));
  const { stdout } = await promisify(execFile)(
    'pnpm',
    ['-F', 'mcp-apps-studio', 'start', 'test', '../components', '--out', out],
    { cwd: repoRoot },
  );
  expect(stdout).toContain('0 failed');
  const report = JSON.parse(await fs.readFile(path.join(out, 'report.json'), 'utf8')) as {
    results: { widget: string; scenario: string; theme: string; ok: boolean; screenshot: string }[];
  };
  expect(report.results.length).toBeGreaterThanOrEqual(12);
  expect(report.results.every((r) => r.ok)).toBe(true);
  for (const r of report.results) await expect(fs.stat(path.join(out, r.screenshot))).resolves.toBeTruthy();
  await fs.rm(out, { recursive: true, force: true });
});

test('visual regression: baselines, unchanged pass, a color change fails with a diff and an HTML report', async () => {
  test.setTimeout(180_000);
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-'));
  const widget = (color: string) => `<!doctype html><html><body style="margin:0">
<div id="box" style="width:200px;height:120px;background:${color}"></div><script>
  let id = 0; const pending = new Map();
  const request = (method, params) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve);
    parent.postMessage({ jsonrpc: '2.0', id: i, method, params }, '*'); });
  addEventListener('message', (ev) => { const m = ev.data;
    if (m && m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  request('ui/initialize', { protocolVersion: '2026-01-26', appInfo: { name: 'box', version: '1' }, appCapabilities: {} })
    .then(() => parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*'));
</script></body></html>`;
  await fs.writeFile(path.join(project, 'box.html'), widget('rgb(20, 120, 220)'));
  await fs.writeFile(
    path.join(project, 'box.stories.mcp.ts'),
    `export default { title: 'Box', widget: './box.html', scenarios: { default: {} } };\n`,
  );
  const out = path.join(project, 'out');
  const run = (...extra: string[]) =>
    promisify(execFile)('pnpm', ['-F', 'mcp-apps-studio', 'start', 'test', project, '--out', out, ...extra], {
      cwd: repoRoot,
    });

  await run('--update-snapshots');
  await expect(fs.stat(path.join(project, 'mcp-studio-snapshots', 'box', 'default.light.png'))).resolves.toBeTruthy();
  await run(); // unchanged → exit 0

  await fs.writeFile(path.join(project, 'box.html'), widget('rgb(220, 40, 40)'));
  const failed = await run().then(
    () => null,
    (e: { code: number; stdout: string }) => e,
  );
  expect(failed?.code).toBe(1);
  expect(failed?.stdout).toMatch(/pixels differ/);
  await expect(fs.stat(path.join(out, 'box', 'default.light.diff.png'))).resolves.toBeTruthy();
  const html = await fs.readFile(path.join(out, 'report.html'), 'utf8');
  expect(html).toContain('default.light.diff.png');
  expect(html).toContain('mcp-studio-snapshots/box/default.light.png');
  await fs.rm(project, { recursive: true, force: true });
});

test('interaction steps: a click that sends the wrong arguments fails `test` with the step and what was seen', async () => {
  test.setTimeout(120_000);
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'steps-'));
  await fs.writeFile(
    path.join(project, 'pager.html'),
    `<!doctype html><html><body><button id="next">Next</button><script>
  let id = 0;
  const send = (method, params) => parent.postMessage({ jsonrpc: '2.0', id: ++id, method, params }, '*');
  addEventListener('message', (ev) => { if (ev.data && ev.data.id === 1)
    parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*'); });
  send('ui/initialize', { protocolVersion: '2026-01-26', appInfo: { name: 'pager', version: '1' }, appCapabilities: {} });
  document.getElementById('next').onclick = () => send('tools/call', { name: 'get_rows', arguments: { page: 1 } });
</script></body></html>`,
  );
  await fs.writeFile(
    path.join(project, 'pager.stories.mcp.ts'),
    `export default { title: 'Pager', widget: './pager.html', scenarios: { next: {
  mocks: { get_rows: { kind: 'static', structuredContent: { rows: [] } } },
  steps: [{ click: '#next' }, { expectToolCall: { name: 'get_rows', arguments: { page: 2 } }, timeoutMs: 500 }],
} } };\n`,
  );
  const out = path.join(project, 'out');
  const failed = await promisify(execFile)(
    'pnpm',
    ['-F', 'mcp-apps-studio', 'start', 'test', project, '--out', out, '--themes', 'light'],
    { cwd: repoRoot },
  ).then(
    () => null,
    (e: { code: number }) => e,
  );
  expect(failed?.code).toBe(1);
  const report = JSON.parse(await fs.readFile(path.join(out, 'report.json'), 'utf8')) as {
    results: { failures: string[] }[];
  };
  expect(report.results[0]?.failures).toEqual([
    expect.stringMatching(/^step 2 \(expectToolCall get_rows\): .*get_rows \{"page":1\}/),
  ]);
  await fs.rm(project, { recursive: true, force: true });
});
