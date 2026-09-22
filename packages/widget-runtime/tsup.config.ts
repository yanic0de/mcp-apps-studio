import { defineConfig } from 'tsup';

// Browser library: ESM + bundled declarations; the SDK and React stay peers (one App class per widget).
export default defineConfig({
  entry: { index: 'src/index.ts', react: 'src/react.tsx' },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  external: ['@modelcontextprotocol/ext-apps', '@modelcontextprotocol/sdk', 'zod', 'react'],
});
