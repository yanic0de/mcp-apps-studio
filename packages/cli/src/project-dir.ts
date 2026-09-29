import fs from 'node:fs';
import path from 'node:path';
import { CliError } from './args.js';

/**
 * The `[dir]` of `start`/`test`: must be an existing directory. A missing bare word is most likely a
 * mistyped command (`tset`), so say that instead of a raw ENOENT from discovery.
 */
export function resolveProjectDir(arg: string | undefined, cwd: string = process.cwd()): string {
  if (arg === undefined) return cwd;
  const dir = path.resolve(cwd, arg);
  const stat = fs.statSync(dir, { throwIfNoEntry: false });
  if (!stat) {
    if (!/[/\\]/.test(arg)) throw new CliError(`\`${arg}\` is neither a command nor a directory (see --help)`);
    throw new CliError(`directory not found: ${dir}`);
  }
  if (!stat.isDirectory()) throw new CliError(`not a directory: ${dir}`);
  return dir;
}
