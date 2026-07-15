import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createTestServer } from './server.js';

const PORT = Number(process.env.PORT ?? 3200);
const app = express();
app.use(express.json());

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
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`test-server listening on http://localhost:${PORT}/mcp`);
});
