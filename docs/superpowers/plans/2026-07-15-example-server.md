# Example MCP Server + Studio Passthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reference MCP server (`@studio/example-server`) on the official TS SDK + `@modelcontextprotocol/ext-apps`: `get_metrics` tool with structuredContent + text fallback, `ui://` widget resource linked via `_meta.ui.resourceUri`, streamable HTTP endpoint. Studio gains a `live` scenario: widget HTML loaded from the real server via `resources/read`, tool calls proxied through the MockRouter passthrough hook.

**Architecture:** Server logic lives in a transport-free `createExampleServer()` factory, tested via `InMemoryTransport.createLinkedPair()` + SDK `Client` (no HTTP in unit tests). The HTTP entry (`main.ts`, express, stateless mode — new server+transport per request) is a thin shell with manual CORS for the browser studio. In the studio, `live` is a fourth scenario: Canvas connects an SDK `Client` over `StreamableHTTPClientTransport`, reads the widget resource for srcdoc, and passes a passthrough handler to `HostEmulator` (empty mock config → every tool call proxied). This exercises the exact "production mode" path from the architecture doc.

**Tech Stack:** `@modelcontextprotocol/sdk` (v1), `@modelcontextprotocol/ext-apps`, express, tsx (dev runner). Versions resolved at install time.

## Global Constraints

- Same repo constraints as prior plans (ESM, src exports, node-testable logic).
- example-server does NOT depend on workspace packages — it must look exactly like a third-party server built on the public SDKs (it is living documentation).
- Tool results MUST include a text-only fallback alongside `structuredContent` (spec requirement for hosts without UI).
- Passthrough returns `result.structuredContent ?? result`, and a `result.isError` tool outcome becomes `RpcError(TOOL_ERROR)` — MVP simplification, noted in code.
- Server port: 3100 (`PORT` env override). Endpoint `/mcp`, health at `/health`.

---

### Task 1: @studio/example-server

**Files:**
- Create: `packages/example-server/package.json`, `tsconfig.json`, `src/server.ts`, `src/kpi-card.html`, `src/main.ts`, `src/index.ts`
- Test: `packages/example-server/src/server.test.ts`

**Interfaces:**
- Produces: `createExampleServer(): McpServer`; `KPI_RESOURCE_URI = 'ui://example/kpi-card.html'`; HTTP entry `pnpm -F @studio/example-server dev` on :3100.

- [x] **Step 1: Skeleton + deps** — `pnpm -F @studio/example-server add @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps zod express` + dev `tsx @types/express typescript`. Scripts: `dev: tsx src/main.ts`, `typecheck: tsc --noEmit`.

- [x] **Step 2: Failing test** (`src/server.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { KPI_RESOURCE_URI, createExampleServer } from './server.js';

async function connect() {
  const server = createExampleServer();
  const client = new Client({ name: 'test-harness', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('example server', () => {
  it('lists get_metrics linked to the ui:// resource', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'get_metrics');
    expect(tool).toBeDefined();
    expect(tool?._meta?.['ui']).toMatchObject({ resourceUri: KPI_RESOURCE_URI });
  });

  it('returns structuredContent plus text fallback from tools/call', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'get_metrics', arguments: {} });
    expect(result.structuredContent).toMatchObject({
      value: expect.any(Number),
      delta: expect.any(Number),
      label: expect.any(String),
    });
    expect(result.content).toEqual([{ type: 'text', text: expect.stringContaining('Monthly active users') }]);
  });

  it('serves the widget HTML as an MCP Apps resource', async () => {
    const client = await connect();
    const res = await client.readResource({ uri: KPI_RESOURCE_URI });
    const first = res.contents[0] as { mimeType?: string; text?: string };
    expect(first.mimeType).toBe(RESOURCE_MIME_TYPE);
    expect(first.text).toContain('ui/initialize');
  });
});
```

- [x] **Step 3: verify FAIL** → **Step 4: implement**

`src/server.ts`:
```ts
import fs from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';

export const KPI_RESOURCE_URI = 'ui://example/kpi-card.html';

export function createExampleServer(): McpServer {
  const server = new McpServer({ name: 'studio-example-server', version: '0.1.0' });

  registerAppTool(
    server,
    'get_metrics',
    {
      title: 'Get metrics',
      description: 'Returns the current KPI metrics.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: KPI_RESOURCE_URI } },
    },
    async () => {
      const metrics = { value: 12840, delta: 8.3, label: 'Monthly active users' };
      return {
        // Text fallback is mandatory: hosts without UI support render only this.
        content: [{ type: 'text', text: `${metrics.label}: ${metrics.value} (${metrics.delta >= 0 ? '+' : ''}${metrics.delta}%)` }],
        structuredContent: metrics,
      };
    },
  );

  registerAppResource(
    server,
    'KPI Card',
    KPI_RESOURCE_URI,
    { description: 'KPI card widget UI', mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: KPI_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await fs.readFile(new URL('./kpi-card.html', import.meta.url), 'utf8'),
        },
      ],
    }),
  );

  return server;
}
```

`src/kpi-card.html` — copy of studio demo widget with label `KPI · example-server` (same protocol flow: ui/initialize → theme → tools/call get_metrics → size-changed; loading/error states).

`src/main.ts`:
```ts
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createExampleServer } from './server.js';

const PORT = Number(process.env.PORT ?? 3100);
const app = express();
app.use(express.json());

// Browser studio runs on another origin; MCP streamable HTTP needs these headers.
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version, last-event-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Stateless mode: fresh server + transport per request, nothing to correlate between calls.
app.post('/mcp', async (req, res) => {
  const server = createExampleServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`example-server listening on http://localhost:${PORT}/mcp`);
});
```

`src/index.ts`: `export * from './server.js';`

- [x] **Step 5: tests PASS + typecheck** → **Step 6: HTTP smoke** — start `pnpm -F @studio/example-server dev` in background, `curl /health`, POST initialize JSON-RPC to `/mcp` (Accept: `application/json, text/event-stream`), expect serverInfo. Stop server.

- [x] **Step 7: commit** `feat(example-server): reference MCP Apps server with get_metrics tool and ui:// resource`

---

### Task 2: Studio `live` scenario (passthrough + resource widget)

**Files:**
- Create: `apps/studio/src/mcp-client.ts`
- Modify: `apps/studio/src/store.ts`, `apps/studio/src/store.test.ts`, `apps/studio/src/components/Canvas.tsx`, `apps/studio/src/components/HeaderControls.tsx`, `apps/studio/package.json` (add `@modelcontextprotocol/sdk`)

**Interfaces:**
- `ScenarioId` gains `'live'`; `scenarios.live = {}` (empty mocks → passthrough handles all).
- `mcp-client.ts` produces: `connectExampleServer(url?): Promise<LiveConnection>` where `LiveConnection = { widgetHtml: string; callTool: PassthroughHandler; close(): Promise<void> }`.

- [x] **Step 1: store test first** — extend scenario-keys assertion to `['default', 'loading', 'error', 'live']`, add `it('live scenario has no mocks', ...)` expecting `scenarios.live` to equal `{}`. Verify FAIL, then update `store.ts` (`ScenarioId` union + `live: {}`).

- [x] **Step 2: mcp-client** (`src/mcp-client.ts`)

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ERROR_CODES } from '@studio/shared';
import { RpcError, type PassthroughHandler } from '@studio/host-emulator';

export const EXAMPLE_SERVER_URL = 'http://localhost:3100/mcp';
export const KPI_RESOURCE_URI = 'ui://example/kpi-card.html';

export interface LiveConnection {
  widgetHtml: string;
  callTool: PassthroughHandler;
  close: () => Promise<void>;
}

export async function connectExampleServer(url: string = EXAMPLE_SERVER_URL): Promise<LiveConnection> {
  const client = new Client({ name: 'mcp-apps-studio', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));

  const resource = await client.readResource({ uri: KPI_RESOURCE_URI });
  const widgetHtml = (resource.contents[0] as { text?: string } | undefined)?.text;
  if (!widgetHtml) {
    await client.close();
    throw new Error(`Resource ${KPI_RESOURCE_URI} has no text content`);
  }

  const callTool: PassthroughHandler = async (toolName, args) => {
    const result = await client.callTool({ name: toolName, arguments: (args ?? {}) as Record<string, unknown> });
    if (result.isError) {
      const text = Array.isArray(result.content)
        ? result.content.map((c) => ('text' in c ? c.text : '')).join(' ')
        : 'tool call failed';
      throw new RpcError(ERROR_CODES.TOOL_ERROR, text.trim() || 'tool call failed');
    }
    // MVP simplification: widgets get structuredContent when the tool provides it.
    return result.structuredContent ?? result;
  };

  return { widgetHtml, callTool, close: () => client.close() };
}
```

- [x] **Step 3: Canvas live wiring** — second state `live: LiveConnection | null` + `liveError: string | null`; effect on `scenario === 'live'` connects (cleanup closes); emulator effect waits for connection, passes `passthrough: live.callTool` and `mocks: scenarios[scenario]`; srcdoc = `live.widgetHtml` in live mode, local demo otherwise; canvas shows "connecting…"/error placeholder instead of iframe while unavailable. HeaderControls gets `<option value="live">live (example-server)</option>`.

- [x] **Step 4: verify** — `pnpm test && pnpm typecheck && pnpm -F @studio/app build`; e2e smoke: example-server up, studio dev up, curl both; manual click-through reported to user.

- [x] **Step 5: commit** `feat(studio): live scenario — widget and tools served by example-server via MCP client`

## Self-Review Notes

- example-server standalone (no `@studio/*` deps) — intentional, it's living documentation; widget HTML duplicated from the demo on purpose.
- Stateless per-request server instances: no shared state, so `get_metrics` being pure is fine; passthrough sessions from the browser client still work because streamable HTTP client sends initialize per connection and the stateless transport accepts unsessioned requests.
- `registerAppResource` signature `(server, name, uri, config, readCallback)` per ext-apps docs (migration example) — quickstart shows `(server, uri, uri, ...)`, i.e. name may equal uri; using explicit name.
- Root vitest picks up `packages/example-server/src/*.test.ts` automatically.
