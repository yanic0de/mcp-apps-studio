import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { WidgetManifestEntry } from '@studio/shared';

export interface StudioServerOptions {
  studioDist: string;
  manifest: WidgetManifestEntry[];
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

export function createStudioServer(opts: StudioServerOptions): http.Server {
  const distRoot = path.resolve(opts.studioDist);

  return http.createServer((req, res) => {
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

    if (url.pathname === '/api/manifest') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ widgets: opts.manifest }));
      return;
    }

    const rel = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    let filePath = path.normalize(path.join(distRoot, rel));
    if (filePath !== distRoot && !filePath.startsWith(distRoot + path.sep)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = path.join(distRoot, 'index.html'); // SPA fallback
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}
