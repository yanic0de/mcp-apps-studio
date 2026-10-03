import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type DiscoveryError, formatZodIssues, type StudioManifest, type WidgetManifestEntry } from '@studio/shared';
import { build } from 'esbuild';
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

/**
 * Bundles the story: local imports (fixtures, helpers, JSON) are inlined, so each discovery sees their
 * current content — Node would otherwise serve them from its module cache forever. Package imports stay
 * external and resolve from the user's project. Returns the code and the local files it was built from.
 */
async function bundleStory(file: string): Promise<{ code: string; dependencies: string[] }> {
  const dir = path.dirname(file);
  const result = await build({
    entryPoints: [file],
    absWorkingDir: dir,
    bundle: true,
    packages: 'external',
    format: 'esm',
    platform: 'node',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0]?.text ?? '';
  const dependencies = Object.keys(result.metafile.inputs).map((input) => path.resolve(dir, input));
  return { code, dependencies };
}

async function loadStoryConfig(file: string): Promise<{ config: WidgetStoryConfig; dependencies: string[] }> {
  const { code, dependencies } = await bundleStory(file);
  // Written next to the story so its package imports resolve from the user's project.
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
    return { config: parsed.data, dependencies };
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

async function loadEntry(file: string, id: string): Promise<{ entry: WidgetManifestEntry; dependencies: string[] }> {
  const { config, dependencies } = await loadStoryConfig(file);
  const scenarios = Object.fromEntries(
    Object.entries(config.scenarios).map(([name, sc]) => [
      name,
      {
        mocks: sc.mocks ?? {},
        ...(sc.toolCall ? { toolCall: sc.toolCall } : {}),
        ...(sc.steps ? { steps: sc.steps } : {}),
      },
    ]),
  );
  if (isUrl(config.widget)) return { entry: { id, title: config.title, url: config.widget, scenarios }, dependencies };
  const widgetPath = path.resolve(path.dirname(file), config.widget);
  let html: string;
  try {
    html = await fs.readFile(widgetPath, 'utf8');
  } catch {
    throw new Error(`Widget file not found for ${file}: ${config.widget} (resolved to ${widgetPath})`);
  }
  return { entry: { id, title: config.title, html, scenarios }, dependencies };
}

/** The manifest plus what the watcher needs: every local file a story was built from (never sent to the page). */
export interface Discovery extends StudioManifest {
  dependencies: string[];
}

/** Loads every story; a broken one becomes an error entry instead of taking the others down. */
export async function discoverStories(rootDir: string): Promise<Discovery> {
  const files = await findStoryFiles(rootDir);
  const ids = assignIds(rootDir, files);
  const widgets: WidgetManifestEntry[] = [];
  const errors: DiscoveryError[] = [];
  const dependencies = new Set<string>();
  for (const file of files) {
    try {
      const loaded = await loadEntry(file, ids.get(file) ?? file);
      widgets.push(loaded.entry);
      for (const dep of loaded.dependencies) dependencies.add(dep);
    } catch (err) {
      errors.push({ file, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return { widgets, errors, dependencies: [...dependencies] };
}
