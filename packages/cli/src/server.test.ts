import fs from 'node:fs/promises';
import type http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { WidgetManifestEntry } from '@studio/shared';
import { createStudioServer, generateToken } from './server.js';

const TOKEN = 'a'.repeat(32);
const manifest: WidgetManifestEntry[] = [
  { id: 'kpi', title: 'KPI', html: '<html/>', scenarios: { default: { mocks: {} } } },
];

let dist: string;
let server: http.Server | undefined;
let base: string;

beforeAll(async () => {
  dist = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-dist-'));
  await fs.writeFile(path.join(dist, 'index.html'), '<html>studio</html>');
  await fs.mkdir(path.join(dist, 'assets'));
  await fs.writeFile(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
  return async () => fs.rm(dist, { recursive: true, force: true });
});

afterEach(
  () =>
    new Promise<void>((r) => {
      if (!server) return r();
      server.close(() => r());
      server = undefined;
    }),
);

function start(): Promise<string> {
  const s = createStudioServer({ studioDist: dist, manifest, token: TOKEN });
  server = s;
  return new Promise((resolve) => {
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address() as { port: number };
      base = `http://127.0.0.1:${addr.port}`;
      resolve(base);
    });
  });
}

describe('generateToken', () => {
  it('returns 32 hex chars, unique per call', () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{32}$/);
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('createStudioServer', () => {
  it('rejects requests without a token', async () => {
    await start();
    expect((await fetch(`${base}/`)).status).toBe(401);
    expect((await fetch(`${base}/api/manifest`)).status).toBe(401);
  });

  it('rejects a wrong token', async () => {
    await start();
    expect((await fetch(`${base}/?token=${'b'.repeat(32)}`)).status).toBe(401);
  });

  it('accepts query token, sets HttpOnly cookie, serves index', async () => {
    await start();
    const res = await fetch(`${base}/?token=${TOKEN}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('studio');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('mcp_studio_token=');
    expect(cookie).toContain('HttpOnly');
  });

  it('accepts the cookie without a query token', async () => {
    await start();
    const res = await fetch(`${base}/api/manifest`, { headers: { cookie: `mcp_studio_token=${TOKEN}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { widgets: WidgetManifestEntry[] };
    expect(body.widgets).toHaveLength(1);
    expect(body.widgets[0]?.id).toBe('kpi');
  });

  it('serves static assets with correct mime and falls back to index.html', async () => {
    await start();
    const headers = { cookie: `mcp_studio_token=${TOKEN}` };
    const js = await fetch(`${base}/assets/app.js`, { headers });
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('text/javascript');
    const spa = await fetch(`${base}/some/client/route`, { headers });
    expect(spa.status).toBe(200);
    expect(await spa.text()).toContain('studio');
  });

  it('blocks path traversal outside the dist dir', async () => {
    await start();
    const res = await fetch(`${base}/..%2f..%2f..%2fetc%2fpasswd`, {
      headers: { cookie: `mcp_studio_token=${TOKEN}` },
    });
    // must never leak a file outside dist: either rejected or SPA fallback
    const text = await res.text();
    expect(text).not.toContain('root:');
  });
});
