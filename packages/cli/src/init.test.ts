import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverStories } from './discover.js';
import { findWidgetFiles, initStories } from './init.js';

const WIDGET = `<script>parent.postMessage({ jsonrpc: '2.0', id: 1, method: 'ui/initialize' }, '*')</script>`;
let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'init-'));
  await fs.mkdir(path.join(root, 'widgets'));
  await fs.writeFile(path.join(root, 'widgets', 'weather.html'), WIDGET);
  await fs.writeFile(path.join(root, 'widgets', 'plain.html'), '<p>not a widget</p>');
  await fs.mkdir(path.join(root, 'node_modules', 'x'), { recursive: true });
  await fs.writeFile(path.join(root, 'node_modules', 'x', 'w.html'), WIDGET);
  await fs.mkdir(path.join(root, 'dist'));
  await fs.writeFile(path.join(root, 'dist', 'bundle.html'), '<script>/* @modelcontextprotocol/ext-apps */</script>');
});
afterEach(() => fs.rm(root, { recursive: true, force: true }));

describe('findWidgetFiles', () => {
  it('finds MCP Apps widgets, including built ones, skipping node_modules and non-widgets', async () => {
    const found = (await findWidgetFiles(root)).map((f) => path.relative(root, f));
    expect(found).toEqual([path.join('dist', 'bundle.html'), path.join('widgets', 'weather.html')]);
  });
});

describe('initStories', () => {
  it('writes a loadable story with four scenarios next to a source widget', async () => {
    const result = await initStories(root, [path.join(root, 'widgets', 'weather.html')], { tool: 'get_weather' });
    expect(result.created).toEqual([path.join(root, 'widgets', 'weather.stories.mcp.ts')]);
    const [entry] = await discoverStories(path.join(root, 'widgets'));
    expect(entry?.title).toBe('Weather');
    expect(Object.keys(entry?.scenarios ?? {})).toEqual(['default', 'loading', 'error', 'live']);
    expect(entry?.scenarios.default?.toolCall?.name).toBe('get_weather');
  });

  it('puts the story of a built widget under stories/, pointing back at the bundle', async () => {
    const result = await initStories(root, [path.join(root, 'dist', 'bundle.html')], {});
    expect(result.created).toEqual([path.join(root, 'stories', 'bundle.stories.mcp.ts')]);
    const [entry] = await discoverStories(path.join(root, 'stories'));
    expect(entry?.html).toContain('ext-apps');
  });

  it('never overwrites an existing story', async () => {
    const story = path.join(root, 'widgets', 'weather.stories.mcp.ts');
    await fs.writeFile(story, '// mine');
    const result = await initStories(root, [path.join(root, 'widgets', 'weather.html')], {});
    expect(result).toEqual({ created: [], skipped: [story] });
    expect(await fs.readFile(story, 'utf8')).toBe('// mine');
  });
});
