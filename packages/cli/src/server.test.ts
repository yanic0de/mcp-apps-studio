import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { StudioManifest, WidgetManifestEntry } from '@studio/shared';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createStudioServer, generateToken, listenLoopback, PortInUseError, type StudioServer } from './server.js';

const TOKEN = 'a'.repeat(32);
const kpi: WidgetManifestEntry = { id: 'kpi', title: 'KPI', html: '<html/>', scenarios: { default: { mocks: {} } } };
const manifest: StudioManifest = { widgets: [kpi], errors: [] };

let dist: string;
let server: StudioServer | undefined;
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

function start(getManifest: () => Promise<StudioManifest> = async () => manifest): Promise<string> {
  const s = createStudioServer({ studioDist: dist, getManifest, token: TOKEN });
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
    const body = (await res.json()) as StudioManifest;
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

  it('rebuilds the manifest on every /api/manifest request', async () => {
    let calls = 0;
    await start(async () => {
      calls++;
      return { widgets: [{ ...kpi, title: `KPI v${calls}` }], errors: [] };
    });
    const headers = { cookie: `mcp_studio_token=${TOKEN}` };
    const first = (await (await fetch(`${base}/api/manifest`, { headers })).json()) as {
      widgets: WidgetManifestEntry[];
    };
    const second = (await (await fetch(`${base}/api/manifest`, { headers })).json()) as {
      widgets: WidgetManifestEntry[];
    };
    expect(first.widgets[0]?.title).toBe('KPI v1');
    expect(second.widgets[0]?.title).toBe('KPI v2');
  });

  it('passes story errors through with 200', async () => {
    const errors = [{ file: '/p/broken.stories.mcp.ts', message: 'boom' }];
    await start(async () => ({ widgets: [kpi], errors }));
    const res = await fetch(`${base}/api/manifest`, { headers: { cookie: `mcp_studio_token=${TOKEN}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ widgets: [kpi], errors });
  });

  it('streams manifest events to authorized clients only', async () => {
    await start();
    expect((await fetch(`${base}/api/events`)).status).toBe(401);
    const controller = new AbortController();
    const res = await fetch(`${base}/api/events`, {
      headers: { cookie: `mcp_studio_token=${TOKEN}` },
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    await reader.read(); // initial comment flushes headers
    server!.notify('manifest');
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain('event: manifest');
    controller.abort();
  });

  it('answers 500 when manifest discovery fails unexpectedly, without dying', async () => {
    await start(async () => {
      throw new Error('story file is mid-edit');
    });
    const headers = { cookie: `mcp_studio_token=${TOKEN}` };
    const res = await fetch(`${base}/api/manifest`, { headers });
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('story file is mid-edit');
    expect((await fetch(`${base}/`, { headers })).status).toBe(200);
  });

  it('answers 404 for a missing asset instead of the SPA fallback', async () => {
    await start();
    const headers = { cookie: `mcp_studio_token=${TOKEN}` };
    const res = await fetch(`${base}/assets/typo.js`, { headers });
    expect(res.status).toBe(404);
  });

  it('answers 400 to a malformed percent-encoded path instead of crashing', async () => {
    await start();
    const headers = { cookie: `mcp_studio_token=${TOKEN}` };
    const res = await fetch(`${base}/%zz`, { headers });
    expect(res.status).toBe(400);
    // server must survive the bad request
    const after = await fetch(`${base}/api/manifest`, { headers });
    expect(after.status).toBe(200);
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

describe('listenLoopback', () => {
  it('resolves with the bound port on 127.0.0.1', async () => {
    const s = createStudioServer({ studioDist: dist, getManifest: async () => manifest, token: TOKEN });
    server = s;
    const port = await listenLoopback(s, 0);
    expect(port).toBeGreaterThan(0);
    expect((s.address() as net.AddressInfo).address).toBe('127.0.0.1');
  });

  it('rejects with PortInUseError when the port is taken', async () => {
    const blocker = net.createServer();
    await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
    const taken = (blocker.address() as net.AddressInfo).port;
    try {
      const s = createStudioServer({ studioDist: dist, getManifest: async () => manifest, token: TOKEN });
      const err = await listenLoopback(s, taken).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PortInUseError);
      expect((err as PortInUseError).port).toBe(taken);
    } finally {
      await new Promise((r) => blocker.close(r));
    }
  });
});
