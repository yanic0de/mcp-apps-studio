import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import type { WidgetManifestEntry } from '@studio/shared';
import type { WidgetStoryConfig } from './define.js';

const STORY_SUFFIX = '.stories.mcp.ts';
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build']);

export async function findStoryFiles(rootDir: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(path.join(dir, entry.name));
        }
      } else if (entry.name.endsWith(STORY_SUFFIX)) {
        found.push(path.join(dir, entry.name));
      }
    }
  }
  await walk(rootDir);
  return found.sort();
}

async function loadStoryConfig(file: string): Promise<WidgetStoryConfig> {
  const source = await fs.readFile(file, 'utf8');
  const { code } = await transform(source, { loader: 'ts', format: 'esm' });
  // Written next to the story so its own imports resolve from the user's project.
  const tmp = path.join(path.dirname(file), `.story-${crypto.randomBytes(4).toString('hex')}.mjs`);
  await fs.writeFile(tmp, code, 'utf8');
  try {
    const mod = (await import(pathToFileURL(tmp).href)) as { default?: unknown };
    const config = mod.default as WidgetStoryConfig | undefined;
    if (
      !config ||
      typeof config !== 'object' ||
      typeof config.title !== 'string' ||
      typeof config.widget !== 'string' ||
      typeof config.scenarios !== 'object' ||
      config.scenarios === null
    ) {
      throw new Error(`Invalid story config in ${file}: expected default export { title, widget, scenarios }`);
    }
    return config;
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

export async function discoverStories(rootDir: string): Promise<WidgetManifestEntry[]> {
  const entries: WidgetManifestEntry[] = [];
  for (const file of await findStoryFiles(rootDir)) {
    const config = await loadStoryConfig(file);
    const html = await fs.readFile(path.resolve(path.dirname(file), config.widget), 'utf8');
    entries.push({
      id: path.basename(file).slice(0, -STORY_SUFFIX.length),
      title: config.title,
      html,
      scenarios: Object.fromEntries(
        Object.entries(config.scenarios).map(([name, sc]) => [name, { mocks: sc.mocks ?? {} }]),
      ),
    });
  }
  return entries;
}
