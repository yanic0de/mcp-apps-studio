import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// What users see: streams and exit codes of the real bin (via tsx), not just the parser.
const pkgDir = path.join(import.meta.dirname, '..');
const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

function cli(...args: string[]) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'src/bin.ts', ...args], {
    cwd: pkgDir,
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, MCP_APPS_STUDIO_DEBUG: '' },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const noStack = (stderr: string) => expect(stderr).not.toMatch(/^\s+at /m);

describe('mcp-apps-studio bin', { timeout: 30_000 }, () => {
  it('--help prints usage and exits without starting a server', () => {
    const r = cli('--help');
    expect(r.code).toBe(0);
    for (const cmd of ['test', 'init', 'add', 'install-browser']) expect(r.stdout).toContain(cmd);
    expect(r.stdout).not.toContain('--token');
  });

  it('test --help prints the test flags', () => {
    const r = cli('test', '--help');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('--max-diff-pixels');
  });

  it('--version prints the package version', () => {
    const r = cli('--version');
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(version);
  });

  it.each([
    [['test', '--theme', 'dark'], '--theme'],
    [['test', '--out'], '--out'],
    [['tset'], 'neither a command nor a directory'],
    [['--port', '70000'], '--port'],
    [['--token', 'abc'], '--token'],
    [['add', 'nope'], 'Available: kpi-card'],
  ])('%j fails with one line naming the problem', (args, expected) => {
    const r = cli(...args);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(expected);
    noStack(r.stderr);
  });

  it('points usage errors to --help', () => {
    expect(cli('test', '--theme', 'dark').stderr).toContain('--help');
  });
});
