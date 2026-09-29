import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type DiscoveryError, formatZodIssues, type StudioManifest, type WidgetManifestEntry } from '@studio/shared';
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

const isUrl = (widget: string) => /^https?:\/\//i.test(widget);

/** Basename ids, or the root-relative path (without the suffix) for stories whose basenames collide. */
function assignIds(rootDir: string, files: string[]): Map<string, string> {
  const base = (f: string) => path.basename(f).slice(0, -STORY_SUFFIX.length);
  const counts = new Map<string, number>();
  for (const f of files) counts.set(base(f), (counts.get(base(f)) ?? 0) + 1);
  return new Map(
    files.map((f) => [
      f,
      (counts.get(base(f)) ?? 0) > 1
        ? path.relative(rootDir, f).slice(0, -STORY_SUFFIX.length).split(path.sep).join('/')
        : base(f),
    ]),
  );
}

async function loadEntry(file: string, id: string): Promise<WidgetManifestEntry> {
  const config = await loadStoryConfig(file);
  const scenarios = Object.fromEntries(
    Object.entries(config.scenarios).map(([name, sc]) => [
      name,
      { mocks: sc.mocks ?? {}, ...(sc.toolCall ? { toolCall: sc.toolCall } : {}) },
    ]),
  );
  if (isUrl(config.widget)) return { id, title: config.title, url: config.widget, scenarios };
  const widgetPath = path.resolve(path.dirname(file), config.widget);
  let html: string;
  try {
    html = await fs.readFile(widgetPath, 'utf8');
  } catch {
    throw new Error(`Widget file not found for ${file}: ${config.widget} (resolved to ${widgetPath})`);
  }
  return { id, title: config.title, html, scenarios };
}

/** Loads every story; a broken one becomes an error entry instead of taking the others down. */
export async function discoverStories(rootDir: string): Promise<StudioManifest> {
  const files = await findStoryFiles(rootDir);
  const ids = assignIds(rootDir, files);
  const widgets: WidgetManifestEntry[] = [];
  const errors: DiscoveryError[] = [];
  for (const file of files) {
    try {
      widgets.push(await loadEntry(file, ids.get(file) ?? file));
    } catch (err) {
      errors.push({ file, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return { widgets, errors };
}
