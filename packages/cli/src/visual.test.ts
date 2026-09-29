import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareWithBaseline } from './visual.js';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-'));
});
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

/** Solid image with an optional differing square in the corner. */
async function png(name: string, w: number, h: number, changed = 0): Promise<string> {
  const img = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const hot = x < changed && y < changed;
      img.data[i] = hot ? 255 : 20;
      img.data[i + 1] = hot ? 0 : 20;
      img.data[i + 2] = hot ? 0 : 20;
      img.data[i + 3] = 255;
    }
  }
  const file = path.join(dir, name);
  await fs.writeFile(file, PNG.sync.write(img));
  return file;
}

const opts = { threshold: 0.1, maxDiffPixels: 0 };

describe('compareWithBaseline', () => {
  it('passes identical images and writes no diff', async () => {
    const r = await compareWithBaseline(await png('a.png', 10, 10), await png('b.png', 10, 10), opts);
    expect(r).toEqual({ ok: true, diffPixels: 0 });
    await expect(fs.stat(path.join(dir, 'a.diff.png'))).rejects.toThrow();
  });

  it('fails on differing pixels and writes the diff image next to the actual', async () => {
    const actual = await png('a.png', 10, 10, 3);
    const r = await compareWithBaseline(actual, await png('b.png', 10, 10), opts);
    expect(r).toMatchObject({ ok: false, diffPixels: 9, diffImage: path.join(dir, 'a.diff.png') });
    expect(r.reason).toMatch(/9 pixels differ/);
    await expect(fs.stat(path.join(dir, 'a.diff.png'))).resolves.toBeTruthy();
  });

  it('tolerates up to maxDiffPixels', async () => {
    const r = await compareWithBaseline(await png('a.png', 10, 10, 3), await png('b.png', 10, 10), {
      ...opts,
      maxDiffPixels: 9,
    });
    expect(r.ok).toBe(true);
  });

  it('fails on a size change, naming both sizes', async () => {
    const r = await compareWithBaseline(await png('a.png', 10, 12), await png('b.png', 10, 10), opts);
    expect(r).toMatchObject({ ok: false });
    expect(r.reason).toMatch(/10×10.*10×12/);
  });

  it('fails on a missing baseline, suggesting --update-snapshots', async () => {
    const r = await compareWithBaseline(await png('a.png', 10, 10), path.join(dir, 'missing.png'), opts);
    expect(r).toMatchObject({ ok: false });
    expect(r.reason).toMatch(/--update-snapshots/);
  });
});
