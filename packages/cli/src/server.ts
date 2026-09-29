import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { StudioManifest } from '@studio/shared';

export interface StudioServerOptions {
  studioDist: string;
  /** Re-invoked on every /api/manifest request; story load failures travel inside it as `errors`. */
  getManifest: () => Promise<StudioManifest>;
  token: string;
}

const COOKIE_NAME = 'mcp_studio_token';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Length-independent comparison: hash both sides, then timingSafeEqual.
function tokensMatch(candidate: string, token: string): boolean {
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(a, b);
}

function isAuthorized(req: http.IncomingMessage, token: string): { ok: boolean; viaQuery: boolean } {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const queryToken = url.searchParams.get('token');
  if (queryToken !== null) {
    return { ok: tokensMatch(queryToken, token), viaQuery: true };
  }
  const match = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`).exec(req.headers.cookie ?? '');
  return { ok: match !== null && tokensMatch(match[1] ?? '', token), viaQuery: false };
}

export interface StudioServer extends http.Server {
  /** Sends `event: <name>` to every connected `/api/events` client (Server-Sent Events). */
  notify(event: string): void;
}

export function createStudioServer(opts: StudioServerOptions): StudioServer {
  const distRoot = path.resolve(opts.studioDist);
  const eventClients = new Set<http.ServerResponse>();

  const server = http.createServer((req, res) => {
    const auth = isAuthorized(req, opts.token);
    if (!auth.ok) {
      res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Unauthorized: open the exact URL printed by the CLI — it carries the access token.');
      return;
    }
    if (auth.viaQuery) {
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${opts.token}; HttpOnly; SameSite=Strict; Path=/`);
    }

    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/api/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      res.write(': connected\n\n'); // flush headers so EventSource opens immediately
      eventClients.add(res);
      req.on('close', () => eventClients.delete(res));
      return;
    }

    if (url.pathname === '/api/manifest') {
      opts
        .getManifest()
        .then(({ widgets, errors }) => {
          // Only what the page needs: discovery extras (e.g. absolute dependency paths) stay server-side.
          res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
          res.end(JSON.stringify({ widgets, errors }));
        })
        .catch((err: unknown) => {
          // a story file mid-edit must not kill the server
          res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(`Manifest discovery failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      return;
    }

    let rel: string;
    try {
      rel = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    } catch {
      // malformed percent-encoding must not crash the process
      res.writeHead(400, { 'content-type': 'text/plain' });
      res.end('Bad Request');
      return;
    }
    let filePath = path.normalize(path.join(distRoot, rel));
    if (filePath !== distRoot && !filePath.startsWith(distRoot + path.sep)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      // A missing asset (known extension) is a real 404; SPA fallback would
      // serve index.html and surface as a confusing MIME error in the browser.
      if (MIME[path.extname(filePath)]) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      filePath = path.join(distRoot, 'index.html'); // SPA fallback for client routes
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  }) as StudioServer;

  server.notify = (event) => {
    for (const client of eventClients) client.write(`event: ${event}\ndata: {}\n\n`);
  };
  // Open event streams would keep close() waiting forever.
  const close = server.close.bind(server);
  server.close = (cb) => {
    for (const client of eventClients) client.end();
    eventClients.clear();
    return close(cb);
  };
  return server;
}

/** The requested port is taken; the CLI turns this into a one-line hint instead of a stack. */
export class PortInUseError extends Error {
  constructor(readonly port: number) {
    super(`port ${port} is already in use — pass --port <other>`);
  }
}

/** Listens on 127.0.0.1 only (never all interfaces) and resolves with the bound port. */
export function listenLoopback(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.off('listening', onListening);
      reject(err.code === 'EADDRINUSE' ? new PortInUseError(port) : err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve((server.address() as AddressInfo).port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}
