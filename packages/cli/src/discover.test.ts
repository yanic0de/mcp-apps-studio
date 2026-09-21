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
    default: { mocks: { get_data: { kind: 'static', result: { n: 1 } } } },
    empty: {},
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
    const entries = await discoverStories(fixture);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'kpi',
      title: 'Test Widget',
      html: '<html>test-widget</html>',
    });
    expect(entries[0]?.scenarios.default?.mocks.get_data).toMatchObject({ kind: 'static' });
    expect(entries[0]?.scenarios.empty).toEqual({ mocks: {} });
  });

  it('rejects a story without default export, naming the file', async () => {
    await fs.writeFile(path.join(fixture, 'src', 'broken.stories.mcp.ts'), 'export const x = 1;');
    await expect(discoverStories(fixture)).rejects.toThrow(/broken\.stories\.mcp\.ts/);
  });

  it('cleans up temp modules next to story files', async () => {
    await discoverStories(fixture);
    const names = await fs.readdir(path.join(fixture, 'src'));
    expect(names.filter((n) => n.endsWith('.mjs'))).toEqual([]);
  });
});

describe('discoverStories validation', () => {
  it('rejects a mock with a misspelled kind, naming file and path', async () => {
    await fs.writeFile(
      path.join(fixture, 'src', 'typo.stories.mcp.ts'),
      `export default { title: 'T', widget: './widget.html', scenarios: { default: { mocks: { get_data: { kind: 'statik', result: 1 } } } } };`,
    );
    await expect(discoverStories(fixture)).rejects.toThrow(
      /typo\.stories\.mcp\.ts.*scenarios\.default\.mocks\.get_data\.kind/s,
    );
  });

  it('rejects a story missing required fields, naming them', async () => {
    await fs.writeFile(path.join(fixture, 'src', 'partial.stories.mcp.ts'), `export default { title: 'T' };`);
    await expect(discoverStories(fixture)).rejects.toThrow(/widget.*scenarios|scenarios.*widget/s);
  });
});
