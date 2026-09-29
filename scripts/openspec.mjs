// `pnpm openspec …` with telemetry off on every OS (an inline `VAR=1 cmd` script breaks on Windows cmd).
import { spawnSync } from 'node:child_process';

const result = spawnSync('openspec', process.argv.slice(2), {
  stdio: 'inherit',
  shell: process.platform === 'win32', // resolves openspec.cmd from node_modules/.bin
  env: { ...process.env, OPENSPEC_TELEMETRY: '0' },
});
process.exit(result.status ?? 1);
