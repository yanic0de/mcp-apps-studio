import { defineConfig } from 'tsup';

// Published CLI: internal workspace packages are bundled; esbuild, playwright-core and zod stay real dependencies.
export default defineConfig({
  entry: { bin: 'src/bin.ts', index: 'src/public.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  noExternal: [/^@studio\//],
  external: ['esbuild', 'playwright-core', 'zod'],
  dts: { entry: { index: 'src/public.ts' }, resolve: [/^@studio\//] },
});
