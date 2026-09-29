import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isRelevantChange, watchProject } from './watcher.js';

describe('isRelevantChange', () => {
  it('accepts stories and html, ignores temp modules, node_modules and dot-dirs', () => {
    expect(isRelevantChange('src/kpi.stories.mcp.ts')).toBe(true);
    expect(isRelevantChange('dist/kpi-card.html')).toBe(true);
    expect(isRelevantChange('src/.story-1a2b3c4d.mjs')).toBe(false);
    expect(isRelevantChange('node_modules/x/w.html')).toBe(false);
    expect(isRelevantChange('.git/index.html')).toBe(false);
    expect(isRelevantChange('src/main.ts')).toBe(false);
  });
});

describe('watchProject', () => {
  let root: string;
  let stop: (() => void) | undefined;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'watch-'));
    await fs.mkdir(path.join(root, 'src'));
  });
  afterEach(async () => {
    stop?.();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reports a burst of relevant changes once, debounced', async () => {
    let calls = 0;
    stop = watchProject(root, () => calls++, { debounceMs: 100 });
    await new Promise((r) => setTimeout(r, 50));
    for (let i = 0; i < 3; i++) await fs.writeFile(path.join(root, 'src', 'a.stories.mcp.ts'), `// ${i}`);
    await fs.writeFile(path.join(root, 'src', '.story-deadbeef.mjs'), 'x');
    await new Promise((r) => setTimeout(r, 400));
    expect(calls).toBe(1);
  });

  it('ignores irrelevant files', async () => {
    let calls = 0;
    stop = watchProject(root, () => calls++, { debounceMs: 50 });
    await new Promise((r) => setTimeout(r, 50));
    await fs.writeFile(path.join(root, 'src', 'main.ts'), 'x');
    await new Promise((r) => setTimeout(r, 250));
    expect(calls).toBe(0);
  });
});
