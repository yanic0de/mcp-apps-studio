import fs from 'node:fs/promises';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface VisualOptions {
  /** pixelmatch per-pixel color tolerance, 0..1. */
  threshold: number;
  /** Number of differing pixels still accepted. */
  maxDiffPixels: number;
}

export interface VisualResult {
  ok: boolean;
  diffPixels?: number;
  reason?: string;
  /** Written next to the actual screenshot when pixels differ. */
  diffImage?: string;
}

const readPng = async (file: string) => PNG.sync.read(await fs.readFile(file));

/** Compares a run's screenshot with its baseline; a differing run gets `<name>.diff.png` beside it. */
export async function compareWithBaseline(
  actual: string,
  baseline: string,
  opts: VisualOptions,
): Promise<VisualResult> {
  let expected: PNG;
  try {
    expected = await readPng(baseline);
  } catch {
    return { ok: false, reason: `no baseline at ${baseline} — run with --update-snapshots to create it` };
  }
  const got = await readPng(actual);
  if (got.width !== expected.width || got.height !== expected.height) {
    return {
      ok: false,
      reason: `size changed: baseline ${expected.width}×${expected.height}, actual ${got.width}×${got.height}`,
    };
  }
  const diff = new PNG({ width: got.width, height: got.height });
  const diffPixels = pixelmatch(got.data, expected.data, diff.data, got.width, got.height, {
    threshold: opts.threshold,
  });
  if (diffPixels <= opts.maxDiffPixels) return { ok: true, diffPixels };
  const diffImage = actual.replace(/\.png$/, '.diff.png');
  await fs.writeFile(diffImage, PNG.sync.write(diff));
  return { ok: false, diffPixels, diffImage, reason: `visual change: ${diffPixels} pixels differ from the baseline` };
}
