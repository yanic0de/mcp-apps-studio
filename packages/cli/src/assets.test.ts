import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { locateAssets } from './assets.js';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'assets-'));
});
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

describe('locateAssets', () => {
  it('prefers the studio and registry bundled next to the module (installed package)', async () => {
    await fs.mkdir(path.join(dir, 'studio'), { recursive: true });
    await fs.writeFile(path.join(dir, 'studio', 'index.html'), '<html/>');
    await fs.mkdir(path.join(dir, 'registry'), { recursive: true });
    await fs.writeFile(path.join(dir, 'registry', 'registry.json'), '{"items":[]}');
    const assets = locateAssets(pathToFileURL(path.join(dir, 'bin.js')).href);
    expect(assets).toEqual({ studioDist: path.join(dir, 'studio'), registryRoot: path.join(dir, 'registry') });
  });

  it('falls back to the workspace packages in development', () => {
    const assets = locateAssets(pathToFileURL(path.join(dir, 'bin.js')).href);
    expect(assets.studioDist).toMatch(/apps[/\\]studio[/\\]dist$/);
    expect(assets.registryRoot).toMatch(/packages[/\\]components$/);
  });
});
