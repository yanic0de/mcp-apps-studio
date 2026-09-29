// Proves the release is installable: pack both public packages, install the tarballs into an empty
// project with one vanilla widget, then `mcp-apps-studio init` + `mcp-apps-studio test` must pass.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repo = path.join(import.meta.dirname, '..');
const run = (cmd, args, cwd = repo) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
const fail = (msg) => {
  console.error(`\npack-smoke: ${msg}`);
  process.exit(1);
};

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-studio-smoke-'));
const packs = path.join(work, 'packs');
const project = path.join(work, 'project');

run('pnpm', ['-F', '@studio/app', 'build']);
run('pnpm', ['-F', '@mcp-apps-studio/widget-runtime', 'build']);
run('pnpm', ['-F', 'mcp-apps-studio', 'build']);
run('pnpm', ['-F', 'mcp-apps-studio', '-F', '@mcp-apps-studio/widget-runtime', 'pack', '--pack-destination', packs]);

const tarballs = await fs.readdir(packs);
const cliTgz = path.join(
  packs,
  tarballs.find((f) => f.startsWith('mcp-apps-studio-0') || f.startsWith('mcp-apps-studio-1')) ?? '',
);
const runtimeTgz = path.join(packs, tarballs.find((f) => f.includes('widget-runtime')) ?? '');

// Published manifests must not point at the workspace; every tarball carries README and LICENSE.
for (const tgz of [cliTgz, runtimeTgz]) {
  const dir = path.join(work, path.basename(tgz, '.tgz'));
  await fs.mkdir(dir);
  run('tar', ['xzf', tgz, '-C', dir]);
  const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package', 'package.json'), 'utf8'));
  // npm shows the README on the package page; the license text must travel with the code.
  for (const file of ['README.md', 'LICENSE']) {
    await fs.access(path.join(dir, 'package', file)).catch(() => fail(`${path.basename(tgz)} has no ${file}`));
  }
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (name.startsWith('@studio/') || String(range).startsWith('workspace:')) {
        fail(`${pkg.name} ${field} references ${name}@${range}`);
      }
    }
  }
}

await fs.mkdir(path.join(project, 'widgets'), { recursive: true });
await fs.writeFile(
  path.join(project, 'package.json'),
  JSON.stringify({ name: 'smoke', private: true, type: 'module' }),
);
await fs.writeFile(
  path.join(project, 'widgets', 'hello.html'),
  `<!doctype html><html><body><p id="out">waiting</p><script>
  let id = 0; const pending = new Map();
  const request = (method, params) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve);
    parent.postMessage({ jsonrpc: '2.0', id: i, method, params }, '*'); });
  addEventListener('message', (ev) => { const m = ev.data;
    if (m && m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    if (m && m.method === 'ui/notifications/tool-result') document.getElementById('out').textContent = JSON.stringify(m.params); });
  request('ui/initialize', { protocolVersion: '2026-01-26', appInfo: { name: 'hello', version: '1' }, appCapabilities: {} })
    .then(() => parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*'));
</script></body></html>`,
);

// Latest SDK exactly as the ext-apps README tells users to install it: our peers must accept it.
const install = spawnSync(
  'npm',
  [
    'install',
    '--no-audit',
    '--no-fund',
    cliTgz,
    runtimeTgz,
    '@modelcontextprotocol/ext-apps',
    '@modelcontextprotocol/client',
    'zod',
  ],
  { cwd: project, encoding: 'utf8', shell: process.platform === 'win32' },
);
process.stdout.write(install.stdout);
process.stderr.write(install.stderr);
if (install.status !== 0) fail('npm install failed');
if (
  /Could not resolve dependency|ERESOLVE|unmet peer/i.test(install.stderr) &&
  install.stderr.includes('@mcp-apps-studio')
) {
  fail('npm reports an unmet peer dependency for our packages');
}

run(
  'node',
  [
    '-e',
    "import('@mcp-apps-studio/widget-runtime').then((m) => { if (typeof m.connectWidget !== 'function') process.exit(1) })",
  ],
  project,
);
// The installed bin must find its own package.json (version) and reject bad input without a stack.
const version = spawnSync('npx', ['mcp-apps-studio', '--version'], {
  cwd: project,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (version.status !== 0 || !/^\d+\.\d+\.\d+/.test(version.stdout.trim())) {
  throw new Error(`--version failed: ${version.stdout}${version.stderr}`);
}
const typo = spawnSync('npx', ['mcp-apps-studio', 'tset'], {
  cwd: project,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (typo.status !== 1 || !typo.stderr.includes('neither a command nor a directory')) {
  throw new Error(`typo handling failed: ${typo.stderr}`);
}
run('npx', ['mcp-apps-studio', 'install-browser'], project);
run('npx', ['mcp-apps-studio', 'init', 'widgets/hello.html', '--tool', 'get_hello'], project);
run('npx', ['mcp-apps-studio', 'test', '--out', 'out'], project);

const report = JSON.parse(await fs.readFile(path.join(project, 'out', 'report.json'), 'utf8'));
const expected = ['default', 'loading', 'error'].flatMap((s) => [`${s}.light`, `${s}.dark`]).sort();
const got = report.results.map((r) => `${r.scenario}.${r.theme}`).sort();
if (JSON.stringify(got) !== JSON.stringify(expected)) fail(`unexpected runs: ${got.join(', ')}`);
if (!report.results.every((r) => r.ok)) fail('some runs failed');

await fs.rm(work, { recursive: true, force: true });
console.log('\npack-smoke: OK — installed from tarballs, init + test passed');
