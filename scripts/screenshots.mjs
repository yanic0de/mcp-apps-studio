// README screenshots from the real product: the studio over the component library, its trace, and
// a test report with a visual diff. Rerun before a release: `node scripts/screenshots.mjs`.
// Needs `pnpm -F @studio/app build`, `pnpm -F @studio/components build` and Chromium (install-browser).
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const repoRoot = path.join(import.meta.dirname, '..');
const cliDir = path.join(repoRoot, 'packages', 'cli');
const componentsDir = path.join(repoRoot, 'packages', 'components');
const assets = path.join(repoRoot, 'docs', 'assets');
const TOKEN = 'screenshots-screenshots-screenshots';
const cli = (...args) => ['--import', 'tsx', 'src/bin.ts', ...args];

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function startStudio(port) {
  const child = spawn(process.execPath, cli('--port', String(port), '--token', TOKEN, componentsDir), {
    cwd: cliDir,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => d.toString().includes('→ http') && resolve());
    child.on('exit', (code) => reject(new Error(`studio exited with ${code}`)));
  });
  return child;
}

/** A small project with the built kpi-card, baselined, then restyled: `test` fails with a diff. */
async function reportWithDiff() {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-shots-'));
  await fs.mkdir(path.join(project, 'dist'));
  await fs.mkdir(path.join(project, 'src', 'kpi-card'), { recursive: true });
  const html = await fs.readFile(path.join(componentsDir, 'dist', 'kpi-card.html'), 'utf8');
  await fs.writeFile(path.join(project, 'dist', 'kpi-card.html'), html);
  await fs.copyFile(
    path.join(componentsDir, 'src', 'kpi-card', 'kpi-card.stories.mcp.ts'),
    path.join(project, 'src', 'kpi-card', 'kpi-card.stories.mcp.ts'),
  );
  const out = path.join(project, 'out');
  const test = (...extra) => {
    try {
      execFileSync(process.execPath, cli('test', project, '--out', out, '--themes', 'light', ...extra), {
        cwd: cliDir,
        stdio: 'ignore',
      });
    } catch {
      // the second run is expected to fail: that is the point of the picture
    }
  };
  test('--update-snapshots');
  // Same box size, different pixels: a lighter value font (a size change would only report "size changed").
  const restyled = html.replace('font-size:34px;font-weight:700', 'font-size:34px;font-weight:300');
  if (restyled === html) throw new Error('kpi-card.html: value font rule not found, update the restyle rule');
  await fs.writeFile(path.join(project, 'dist', 'kpi-card.html'), restyled);
  test();
  return { report: path.join(out, 'report.html'), project };
}

await fs.mkdir(assets, { recursive: true });
const port = await freePort();
const studio = await startStudio(port);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const open = async (query) => {
    await page.goto(`http://127.0.0.1:${port}/?token=${TOKEN}&${query}`);
    await page.frameLocator('iframe[title="widget under test"]').locator('body').waitFor();
    await page.waitForTimeout(800); // handshake, tool call and fonts settle
  };

  await open('widget=kpi-card&scenario=default&theme=light');
  // The widget's own tools/call and its CallToolResult: the most telling rows of the trace.
  await page.locator('.trace-row', { hasText: '#1' }).locator('summary').click();
  await page.screenshot({ path: path.join(assets, 'studio-light.png') });

  await open('widget=data-table&scenario=default&theme=dark');
  await page.screenshot({ path: path.join(assets, 'studio-dark.png') });

  await open('widget=kpi-card&scenario=error&theme=light');
  await page.locator('aside.trace').screenshot({ path: path.join(assets, 'trace.png') });

  const { report, project } = await reportWithDiff();
  await page.goto(`file://${report}`);
  await page.screenshot({ path: path.join(assets, 'report-diff.png'), fullPage: false });
  await fs.rm(project, { recursive: true, force: true });
} finally {
  await browser.close();
  studio.kill();
}

for (const f of await fs.readdir(assets)) {
  const { size } = await fs.stat(path.join(assets, f));
  console.log(`${f}  ${Math.round(size / 1024)} KB`);
}
