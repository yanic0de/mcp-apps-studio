import type { AddressInfo } from 'node:net';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { createTestServer } from './server.js';

// Loopback unless asked otherwise (e.g. HOST=0.0.0.0 in a container): tools must not be reachable from the LAN.
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3200);
// MCP SDK v2 express app: JSON body parsing + localhost host/origin validation (DNS-rebinding protection).
const app = createMcpExpressApp();

// Browser studio runs on another origin; MCP streamable HTTP needs these headers.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version, last-event-id',
  );
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Stateless mode: fresh server + transport per request (counter state is module-level).
app.post('/mcp', async (req, res) => {
  const server = createTestServer();
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const server = app.listen(PORT, HOST, () => {
  const { address, port } = server.address() as AddressInfo;
  const host = address.includes(':') ? `[${address}]` : address;
  console.log(`test-server listening on http://${host}:${port}/mcp`);
});
