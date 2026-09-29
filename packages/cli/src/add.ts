import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { locateAssets } from './assets.js';

interface RegistryItem {
  name: string;
  title: string;
  description: string;
  files: string[];
  dependencies: string[];
}

interface Registry {
  items: RegistryItem[];
}

async function readRegistry(): Promise<{ pkgRoot: string; registry: Registry }> {
  const pkgRoot = locateAssets().registryRoot;
  const registry = JSON.parse(await fs.readFile(path.join(pkgRoot, 'registry.json'), 'utf8')) as Registry;
  return { pkgRoot, registry };
}

/** Thrown for a name that is not in the registry; the message lists what is available. */
export class UnknownComponentError extends Error {}

/**
 * Copies a registry component's source files into `<targetDir>/<name>/` (shadcn model). Files the
 * user already has are theirs (they may have edited them): skipped unless `force`.
 */
export async function addComponent(
  name: string,
  targetDir: string,
  opts: { force?: boolean } = {},
): Promise<{ copied: string[]; skipped: string[] }> {
  const { pkgRoot, registry } = await readRegistry();
  const item = registry.items.find((i) => i.name === name);
  if (!item) {
    const available = registry.items.map((i) => i.name).join(', ');
    throw new UnknownComponentError(`Unknown component "${name}". Available: ${available}`);
  }
  const destDir = path.join(targetDir, item.name);
  await fs.mkdir(destDir, { recursive: true });
  const copied: string[] = [];
  const skipped: string[] = [];
  for (const file of item.files) {
    const dest = path.join(destDir, path.basename(file));
    try {
      // COPYFILE_EXCL: the existence check and the copy are one atomic step.
      await fs.copyFile(path.join(pkgRoot, file), dest, opts.force ? 0 : fsConstants.COPYFILE_EXCL);
      copied.push(dest);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      skipped.push(dest);
    }
  }
  return { copied, skipped };
}

export async function listComponents(): Promise<RegistryItem[]> {
  const { registry } = await readRegistry();
  return registry.items;
}
