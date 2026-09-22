import fs from 'node:fs/promises';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = import.meta.dirname;

/**
 * zod re-exports all 50+ locales as `z.locales`; the ext-apps SDK imports zod as a namespace, so every
 * locale (~200 KB) lands in the widget. Only `en` (zod's default, imported directly) is ever used.
 */
const zodEnglishOnly = {
  name: 'zod-english-only',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || !source.endsWith('locales/index.js') || !importer.includes('/zod/')) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    if (!resolved) return null;
    return `\0zod-locales:${path.dirname(resolved.id)}`;
  },
  load(id) {
    if (!id.startsWith('\0zod-locales:')) return null;
    const dir = id.slice('\0zod-locales:'.length);
    return `export { default as en } from ${JSON.stringify(path.join(dir, 'en.js'))};`;
  },
};
const widgets = ['kpi-card', 'data-table'];

for (const widget of widgets) {
  await build({
    configFile: false,
    root: path.join(here, 'src', widget),
    plugins: [zodEnglishOnly, react(), viteSingleFile()],
    logLevel: 'warn',
    build: {
      target: 'es2022',
      outDir: path.join(here, 'dist', widget),
      emptyOutDir: true,
    },
  });
  await fs.copyFile(path.join(here, 'dist', widget, 'index.html'), path.join(here, 'dist', `${widget}.html`));
  console.log(`built dist/${widget}.html`);
}
