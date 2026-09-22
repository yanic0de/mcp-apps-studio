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

/** Copies a registry component's source files into `<targetDir>/<name>/` (shadcn model). */
export async function addComponent(name: string, targetDir: string): Promise<string[]> {
  const { pkgRoot, registry } = await readRegistry();
  const item = registry.items.find((i) => i.name === name);
  if (!item) {
    const available = registry.items.map((i) => i.name).join(', ');
    throw new Error(`Unknown component "${name}". Available: ${available}`);
  }
  const destDir = path.join(targetDir, item.name);
  await fs.mkdir(destDir, { recursive: true });
  const copied: string[] = [];
  for (const file of item.files) {
    const dest = path.join(destDir, path.basename(file));
    await fs.copyFile(path.join(pkgRoot, file), dest);
    copied.push(dest);
  }
  return copied;
}

export async function listComponents(): Promise<RegistryItem[]> {
  const { registry } = await readRegistry();
  return registry.items;
}
