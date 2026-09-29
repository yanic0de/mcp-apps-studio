import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliError } from './args.js';
import { resolveProjectDir } from './project-dir.js';

let cwd: string;
beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'project-dir-'));
  await fs.mkdir(path.join(cwd, 'widgets'));
  await fs.writeFile(path.join(cwd, 'file.txt'), '');
});
afterEach(() => fs.rm(cwd, { recursive: true, force: true }));

describe('resolveProjectDir', () => {
  it('defaults to the working directory', () => {
    expect(resolveProjectDir(undefined, cwd)).toBe(cwd);
  });

  it('resolves an existing directory', () => {
    expect(resolveProjectDir('widgets', cwd)).toBe(path.join(cwd, 'widgets'));
  });

  it('reads a missing bare word as a mistyped command', () => {
    expect(() => resolveProjectDir('tset', cwd)).toThrow(CliError);
    expect(() => resolveProjectDir('tset', cwd)).toThrow(/`tset` is neither a command nor a directory/);
  });

  it('reports a missing path as a missing directory', () => {
    expect(() => resolveProjectDir('src/nope', cwd)).toThrow(/directory not found: .*nope/);
  });

  it('rejects a file', () => {
    expect(() => resolveProjectDir('file.txt', cwd)).toThrow(/not a directory/);
  });
});
