import fs from 'node:fs/promises';
import path from 'node:path';

/** Strings every MCP Apps widget contains: the handshake method, or the SDK when bundled. */
const WIDGET_MARKERS = ['ui/initialize', '@modelcontextprotocol/ext-apps'];
/** Build output is wiped on rebuild, so stories for built widgets go to `<root>/stories/`. */
const BUILD_DIRS = new Set(['dist', 'build']);

/** Finds widget HTML files under `root` (built ones included), skipping node_modules and dot-directories. */
export async function findWidgetFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) await walk(full);
      } else if (entry.name.endsWith('.html')) {
        const html = await fs.readFile(full, 'utf8');
        if (WIDGET_MARKERS.some((m) => html.includes(m))) found.push(full);
      }
    }
  }
  await walk(root);
  return found.sort();
}

const titleOf = (name: string) =>
  name
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');

function storySource(title: string, widgetPath: string, tool: string): string {
  return `// Scenarios for ${title}. \`toolCall\` is the model's call that rendered the widget
// (pushed as tool-input → tool-result); \`mocks\` answer the widget's own tools/call.
// Wrap in defineWidgetStory(...) from 'mcp-apps-studio' for type checking.
export default {
  title: ${JSON.stringify(title)},
  widget: ${JSON.stringify(widgetPath)},
  scenarios: {
    default: {
      toolCall: { name: ${JSON.stringify(tool)}, input: {}, result: { kind: 'static', structuredContent: {} } },
      mocks: {},
    },
    loading: {
      toolCall: { name: ${JSON.stringify(tool)}, result: { kind: 'static', structuredContent: {}, delayMs: 3_600_000 } },
    },
    error: {
      toolCall: { name: ${JSON.stringify(tool)}, result: { kind: 'error', message: 'Something went wrong' } },
    },
    // No mocks: the linked tool is called on the server from ?server= and every widget call is proxied.
    live: { mocks: {} },
  },
};
`;
}

/** Scaffolds `<name>.stories.mcp.ts` per widget; existing stories are never overwritten. */
export async function initStories(
  root: string,
  widgets: string[],
  opts: { tool?: string },
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const widget of widgets) {
    const name = path.basename(widget, '.html');
    const built = path
      .relative(root, widget)
      .split(path.sep)
      .some((seg) => BUILD_DIRS.has(seg));
    const storyDir = built ? path.join(root, 'stories') : path.dirname(widget);
    const story = path.join(storyDir, `${name}.stories.mcp.ts`);
    if (
      await fs.stat(story).then(
        () => true,
        () => false,
      )
    ) {
      skipped.push(story);
      continue;
    }
    let rel = path.relative(storyDir, widget).split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    await fs.mkdir(storyDir, { recursive: true });
    await fs.writeFile(story, storySource(titleOf(name), rel, opts.tool ?? 'my_tool'));
    created.push(story);
  }
  return { created, skipped };
}
