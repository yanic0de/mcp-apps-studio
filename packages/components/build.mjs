import fs from 'node:fs/promises';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = import.meta.dirname;
const widgets = ['kpi-card', 'data-table'];

for (const widget of widgets) {
  await build({
    configFile: false,
    root: path.join(here, 'src', widget),
    plugins: [react(), viteSingleFile()],
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
