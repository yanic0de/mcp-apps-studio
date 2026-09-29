import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverStories, findStoryFiles } from './discover.js';

let fixture: string;

const STORY = `
export default {
  title: 'Test Widget',
  widget: './widget.html',
  scenarios: {
    default: { mocks: { get_data: { kind: 'static', structuredContent: { n: 1 } } } },
    empty: {},
    called: { toolCall: { name: 'get_data', input: { q: 1 } } },
  },
};
`;

beforeEach(async () => {
  fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-cli-'));
  await fs.mkdir(path.join(fixture, 'src'));
  await fs.writeFile(path.join(fixture, 'src', 'kpi.stories.mcp.ts'), STORY);
  await fs.writeFile(path.join(fixture, 'src', 'widget.html'), '<html>test-widget</html>');
  // decoys that must be ignored
  await fs.mkdir(path.join(fixture, 'node_modules', 'dep'), { recursive: true });
  await fs.writeFile(path.join(fixture, 'node_modules', 'dep', 'evil.stories.mcp.ts'), 'export default {};');
});

afterEach(() => fs.rm(fixture, { recursive: true, force: true }));

describe('findStoryFiles', () => {
  it('finds story files, skipping node_modules', async () => {
    const files = await findStoryFiles(fixture);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('kpi.stories.mcp.ts');
  });
});

describe('discoverStories', () => {
  it('builds manifest entries with widget html and normalized scenarios', async () => {
    const { widgets: entries, errors } = await discoverStories(fixture);
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'kpi',
      title: 'Test Widget',
      html: '<html>test-widget</html>',
    });
    expect(entries[0]?.scenarios.default?.mocks.get_data).toMatchObject({ kind: 'static' });
    expect(entries[0]?.scenarios.empty).toEqual({ mocks: {} });
    expect(entries[0]?.scenarios.called).toEqual({ mocks: {}, toolCall: { name: 'get_data', input: { q: 1 } } });
  });

  it('isolates a story without default export: listed in errors, the others still load', async () => {
    await fs.writeFile(path.join(fixture, 'src', 'broken.stories.mcp.ts'), 'export const x = 1;');
    const { widgets, errors } = await discoverStories(fixture);
    expect(widgets.map((w) => w.id)).toEqual(['kpi']);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toMatch(/broken\.stories\.mcp\.ts$/);
    expect(errors[0]?.message).toMatch(/default export/);
  });

  it('keeps an http(s) widget as a url instead of reading a file', async () => {
    await fs.writeFile(
      path.join(fixture, 'src', 'dev.stories.mcp.ts'),
      `export default { title: 'Dev', widget: 'http://localhost:5173/', scenarios: { default: {} } };`,
    );
    const { widgets } = await discoverStories(fixture);
    const dev = widgets.find((w) => w.id === 'dev');
    expect(dev).toMatchObject({ url: 'http://localhost:5173/' });
    expect(dev).not.toHaveProperty('html');
  });

  it('disambiguates colliding basenames with the relative path', async () => {
    await fs.mkdir(path.join(fixture, 'other'));
    await fs.writeFile(path.join(fixture, 'other', 'kpi.stories.mcp.ts'), STORY);
    await fs.writeFile(path.join(fixture, 'other', 'widget.html'), '<html>other</html>');
    const { widgets } = await discoverStories(fixture);
    expect(widgets.map((w) => w.id).sort()).toEqual(['other/kpi', 'src/kpi']);
  });

  it('cleans up temp modules next to story files', async () => {
    await discoverStories(fixture);
    const names = await fs.readdir(path.join(fixture, 'src'));
    expect(names.filter((n) => n.endsWith('.mjs'))).toEqual([]);
  });
});

describe('discoverStories validation', () => {
  const errorOf = async () => (await discoverStories(fixture)).errors.map((e) => `${e.file}: ${e.message}`).join('\n');

  it('reports a mock with a misspelled kind, naming file and path', async () => {
    await fs.writeFile(
      path.join(fixture, 'src', 'typo.stories.mcp.ts'),
      `export default { title: 'T', widget: './widget.html', scenarios: { default: { mocks: { get_data: { kind: 'statik', structuredContent: {} } } } } };`,
    );
    expect(await errorOf()).toMatch(/typo\.stories\.mcp\.ts.*scenarios\.default\.mocks\.get_data\.kind/s);
  });

  it('reports a story missing required fields, naming them', async () => {
    await fs.writeFile(path.join(fixture, 'src', 'partial.stories.mcp.ts'), `export default { title: 'T' };`);
    expect(await errorOf()).toMatch(/widget.*scenarios|scenarios.*widget/s);
  });

  it('reports a missing widget file', async () => {
    await fs.writeFile(
      path.join(fixture, 'src', 'lost.stories.mcp.ts'),
      `export default { title: 'L', widget: './nope.html', scenarios: { default: {} } };`,
    );
    expect(await errorOf()).toMatch(/lost\.stories\.mcp\.ts.*nope\.html/s);
  });

  it('picks up an edited fixture the story imports, and reports it as a dependency', async () => {
    const story = path.join(fixture, 'src', 'kpi.stories.mcp.ts');
    const rows = path.join(fixture, 'src', 'rows.json');
    await fs.writeFile(rows, JSON.stringify({ n: 1 }));
    await fs.writeFile(path.join(fixture, 'src', 'helper.ts'), 'export const label = (s: string) => `#${s}`;\n');
    await fs.writeFile(
      story,
      `import rows from './rows.json';
import { label } from './helper';
export default { title: label('T'), widget: './widget.html',
  scenarios: { default: { mocks: { get: { kind: 'static', structuredContent: rows } } } } };\n`,
    );
    const first = await discoverStories(fixture);
    expect(first.widgets[0]?.title).toBe('#T');
    expect(first.widgets[0]?.scenarios.default?.mocks.get).toMatchObject({ structuredContent: { n: 1 } });
    expect(first.dependencies).toEqual(expect.arrayContaining([story, rows, path.join(fixture, 'src', 'helper.ts')]));

    await fs.writeFile(rows, JSON.stringify({ n: 2 }));
    const second = await discoverStories(fixture);
    expect(second.widgets[0]?.scenarios.default?.mocks.get).toMatchObject({ structuredContent: { n: 2 } });
    expect((await fs.readdir(path.join(fixture, 'src'))).filter((f) => f.endsWith('.mjs'))).toEqual([]);
  });

  it('keeps package imports external (resolved from the project)', async () => {
    await fs.mkdir(path.join(fixture, 'node_modules', 'story-kit'), { recursive: true });
    await fs.writeFile(
      path.join(fixture, 'node_modules', 'story-kit', 'package.json'),
      JSON.stringify({ name: 'story-kit', type: 'module', exports: './index.js' }),
    );
    await fs.writeFile(
      path.join(fixture, 'node_modules', 'story-kit', 'index.js'),
      'export const define = (c) => c;\n',
    );
    await fs.writeFile(
      path.join(fixture, 'src', 'kpi.stories.mcp.ts'),
      `import { define } from 'story-kit';\nexport default define({ title: 'K', widget: './widget.html', scenarios: { default: {} } });\n`,
    );
    const manifest = await discoverStories(fixture);
    expect(manifest.errors).toEqual([]);
    expect(manifest.dependencies.some((d) => d.includes('node_modules'))).toBe(false);
  });
});
