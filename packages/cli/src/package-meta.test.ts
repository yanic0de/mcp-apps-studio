import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// What npm users see: the published packages' metadata and the files npm always ships.
const repoRoot = path.join(import.meta.dirname, '..', '..', '..');
const published = ['packages/cli', 'packages/widget-runtime'];
const REPO = 'yanic0de/mcp-apps-studio';

const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

describe.each(published)('%s', (dir) => {
  const pkg = JSON.parse(read(`${dir}/package.json`));

  it('points repository, homepage and bugs at the public repo', () => {
    expect(pkg.repository).toMatchObject({ url: `git+https://github.com/${REPO}.git`, directory: dir });
    expect(pkg.homepage).toContain(`github.com/${REPO}`);
    expect(pkg.bugs).toMatchObject({ url: `https://github.com/${REPO}/issues` });
    expect(pkg.author).toBeTruthy();
  });

  it('requires a supported Node', () => {
    expect(pkg.engines?.node).toBe('>=22');
  });

  it('ships the repository LICENSE and a README', () => {
    expect(read(`${dir}/LICENSE`)).toBe(read('LICENSE'));
    expect(read(`${dir}/README.md`).length).toBeGreaterThan(500);
  });
});
