import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatZodIssues, type WidgetManifestEntry } from '@studio/shared';
import { transform } from 'esbuild';
import { type WidgetStoryConfig, widgetStoryConfigSchema } from './define.js';

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
    if (mod.default === undefined) {
      throw new Error(`Invalid story config in ${file}: expected a default export ({ title, widget, scenarios })`);
    }
    const parsed = widgetStoryConfigSchema.safeParse(mod.default);
    if (!parsed.success) {
      throw new Error(`Invalid story config in ${file}: ${formatZodIssues(parsed.error)}`);
    }
    return parsed.data;
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
