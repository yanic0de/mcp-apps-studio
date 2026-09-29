import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';

let child: ChildProcess | undefined;
afterEach(() => {
  child?.kill();
});

/** Starts main.ts on a free port and resolves with the URL it prints. */
function start(): Promise<URL> {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: '0' };
  delete env.HOST;
  child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: path.join(import.meta.dirname, '..'),
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    let out = '';
    child?.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString();
      const match = out.match(/listening on (http:\/\/\S+)\/mcp/);
      if (match?.[1]) resolve(new URL(match[1]));
    });
    child?.on('exit', (code) => reject(new Error(`main.ts exited with ${code}: ${out}`)));
  });
}

it('listens on loopback by default', { timeout: 20_000 }, async () => {
  const url = await start();
  expect(url.hostname).toBe('127.0.0.1');
  const res = await fetch(new URL('/health', url));
  expect(await res.json()).toEqual({ ok: true });
});
