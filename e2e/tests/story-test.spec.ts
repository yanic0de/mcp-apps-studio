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
