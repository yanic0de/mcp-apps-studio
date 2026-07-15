import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Fixed token so tests can authenticate against the CLI server (see bin --token). */
export const CLI_TOKEN = 'e2e0e2e0e2e0e2e0e2e0e2e0e2e0e2e0';
export const CLI_URL = 'http://127.0.0.1:4499';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'pnpm -F @studio/app dev --port 4173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      cwd: repoRoot,
    },
    {
      command: 'pnpm -F @studio/example-server dev',
      url: 'http://127.0.0.1:3100/health',
      reuseExistingServer: true,
      cwd: repoRoot,
    },
    {
      // pnpm -F runs the script with cwd = packages/cli, hence the relative path.
      command: `pnpm -F @studio/app build && pnpm -F @studio/components build && pnpm -F mcp-apps-studio start --port 4499 --token ${CLI_TOKEN} ../components`,
      url: `${CLI_URL}/?token=${CLI_TOKEN}`,
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: repoRoot,
    },
  ],
});
