# Monorepo Scaffold + Core Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the mcp-apps-studio pnpm+turbo monorepo and implement its two core packages: `@studio/shared` (types, zod schemas, protocol constants) and `@studio/host-emulator` (MessageBridge, HostAdapter interface, mcp-apps adapter, mock router, HostEmulator composition).

**Architecture:** The host emulator is a DOM-free core: a `MessageBridge` validates every incoming message with zod before dispatch (widgets are untrusted), a pure `HostAdapter` translates wire messages ↔ semantic actions (so adapters are testable against golden logs), and a `MockRouter` resolves tool calls from fixture config. The DOM iframe transport comes later in the studio phase; tests use an in-memory transport pair.

**Tech Stack:** TypeScript ~5.8, pnpm 10 workspaces, turbo 2, vitest 3, zod 4.

## Global Constraints

- Package names use the `@studio/` scope (per architecture doc).
- MCP Apps protocol version: `2026-01-26`. Confirmed wire methods only: `ui/initialize`, `tools/call`, `resources/read`, `ui/notifications/size-changed` (view→host); `ui/notifications/host-context-changed`, `ui/notifications/tool-input` (host→view). Follow-up messages deferred (method name unconfirmed).
- Every incoming widget message MUST be zod-validated before processing (security requirement from architecture doc §9).
- Adapters are pure functions of messages/events — no transport access, no side effects.
- Core packages MUST NOT depend on DOM APIs (tests run in node).
- MVP cuts: no server-api, no docs site, no e2e, no openai/legacy adapters, no changesets.
- All ESM (`"type": "module"`). Packages export TS source directly (`"exports": "./src/index.ts"`); build/publish story deferred.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`

**Interfaces:**
- Produces: workspace layout `packages/*`, root scripts `test` (vitest), `typecheck` (turbo).

- [x] **Step 1: git init + root files**

`package.json`:
```json
{
  "name": "mcp-apps-studio",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.28.0",
  "scripts": {
    "test": "vitest run",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "~5.8.0",
    "vitest": "^3.2.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "typecheck": {},
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
});
```

`.gitignore`:
```
node_modules/
dist/
.turbo/
*.log
```

- [x] **Step 2: Verify install**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [x] **Step 3: Commit**

```bash
git init -b main && git add -A && git commit -m "chore: scaffold pnpm+turbo monorepo"
```

---

### Task 2: @studio/shared — JSON-RPC schemas

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/src/json-rpc.ts`
- Test: `packages/shared/src/json-rpc.test.ts`

**Interfaces:**
- Produces:
  - `jsonRpcRequestSchema`, `jsonRpcNotificationSchema`, `jsonRpcResponseSchema` (zod)
  - Types: `JsonRpcId`, `JsonRpcRequest`, `JsonRpcNotification`, `JsonRpcResponse`, `JsonRpcErrorObject`
  - `parseJsonRpcMessage(raw: unknown): ParsedJsonRpc` where `ParsedJsonRpc = { ok: true; kind: 'request'|'notification'|'response'; message: ... } | { ok: false; error: string }`
  - `ERROR_CODES`: `PARSE_ERROR -32700, INVALID_REQUEST -32600, METHOD_NOT_FOUND -32601, INVALID_PARAMS -32602, INTERNAL_ERROR -32603, REQUEST_TIMEOUT -32001, RESOURCE_NOT_FOUND -32002, TOOL_ERROR -32000`

- [x] **Step 1: Package skeleton**

`packages/shared/package.json`:
```json
{
  "name": "@studio/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^4.0.0" },
  "devDependencies": { "typescript": "~5.8.0" }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [x] **Step 2: Write failing test** (`src/json-rpc.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, parseJsonRpcMessage } from './json-rpc.js';

describe('parseJsonRpcMessage', () => {
  it('classifies a request (has method + id)', () => {
    const r = parseJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 't' } });
    expect(r).toMatchObject({ ok: true, kind: 'request', message: { id: 1, method: 'tools/call' } });
  });

  it('classifies a notification (method, no id)', () => {
    const r = parseJsonRpcMessage({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { width: 100 } });
    expect(r).toMatchObject({ ok: true, kind: 'notification' });
  });

  it('classifies success and error responses', () => {
    expect(parseJsonRpcMessage({ jsonrpc: '2.0', id: 'h1', result: {} })).toMatchObject({ ok: true, kind: 'response' });
    expect(parseJsonRpcMessage({ jsonrpc: '2.0', id: 'h1', error: { code: -32601, message: 'nope' } })).toMatchObject({ ok: true, kind: 'response' });
  });

  it.each([null, 42, 'x', [], { jsonrpc: '1.0', method: 'a' }, { jsonrpc: '2.0' }, { jsonrpc: '2.0', id: 1, method: 5 }])(
    'rejects invalid message %#',
    (raw) => {
      expect(parseJsonRpcMessage(raw).ok).toBe(false);
    },
  );

  it('exposes standard error codes', () => {
    expect(ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
  });
});
```

- [x] **Step 3: Run, verify FAIL** — `pnpm vitest run packages/shared` → module not found.

- [x] **Step 4: Implement** (`src/json-rpc.ts`)

```ts
import { z } from 'zod';

export const JSON_RPC_VERSION = '2.0' as const;

export const jsonRpcIdSchema = z.union([z.string(), z.number()]);
export type JsonRpcId = z.infer<typeof jsonRpcIdSchema>;

export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal(JSON_RPC_VERSION),
  id: jsonRpcIdSchema,
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;

export const jsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal(JSON_RPC_VERSION),
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;

export const jsonRpcErrorObjectSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type JsonRpcErrorObject = z.infer<typeof jsonRpcErrorObjectSchema>;

export const jsonRpcResponseSchema = z.union([
  z.object({ jsonrpc: z.literal(JSON_RPC_VERSION), id: jsonRpcIdSchema, result: z.unknown() }),
  z.object({ jsonrpc: z.literal(JSON_RPC_VERSION), id: jsonRpcIdSchema.nullable(), error: jsonRpcErrorObjectSchema }),
]);
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

export const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  REQUEST_TIMEOUT: -32001,
  RESOURCE_NOT_FOUND: -32002,
  TOOL_ERROR: -32000,
} as const;

export type ParsedJsonRpc =
  | { ok: true; kind: 'request'; message: JsonRpcRequest }
  | { ok: true; kind: 'notification'; message: JsonRpcNotification }
  | { ok: true; kind: 'response'; message: JsonRpcResponse }
  | { ok: false; error: string };

function issues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

export function parseJsonRpcMessage(raw: unknown): ParsedJsonRpc {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'message is not an object' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj['jsonrpc'] !== JSON_RPC_VERSION) {
    return { ok: false, error: 'missing or invalid "jsonrpc" field' };
  }
  if ('method' in obj) {
    if ('id' in obj) {
      const r = jsonRpcRequestSchema.safeParse(obj);
      return r.success ? { ok: true, kind: 'request', message: r.data } : { ok: false, error: issues(r.error) };
    }
    const n = jsonRpcNotificationSchema.safeParse(obj);
    return n.success ? { ok: true, kind: 'notification', message: n.data } : { ok: false, error: issues(n.error) };
  }
  if ('result' in obj || 'error' in obj) {
    const resp = jsonRpcResponseSchema.safeParse(obj);
    return resp.success ? { ok: true, kind: 'response', message: resp.data } : { ok: false, error: issues(resp.error) };
  }
  return { ok: false, error: 'not a request, notification, or response' };
}
```

`src/index.ts`:
```ts
export * from './json-rpc.js';
```

- [x] **Step 5: Run, verify PASS** — `pnpm vitest run packages/shared`

- [x] **Step 6: Commit** — `git add -A && git commit -m "feat(shared): JSON-RPC 2.0 zod schemas and message parser"`

---

### Task 3: @studio/shared — domain types (host context, protocol, mocks, widget, rpc-log)

**Files:**
- Create: `packages/shared/src/host-context.ts`, `packages/shared/src/protocol.ts`, `packages/shared/src/mocks.ts`, `packages/shared/src/widget.ts`, `packages/shared/src/rpc-log.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/host-context.test.ts`

**Interfaces:**
- Produces:
  - `hostContextSchema`, `HostContext`, `defaultHostContext`
  - `MCP_APPS_PROTOCOL_VERSION = '2026-01-26'`, `MCP_APPS_METHODS` map
  - `toolsCallParamsSchema` (`{ name: string; arguments?: unknown }`), `resourcesReadParamsSchema` (`{ uri: string }`), `sizeChangedParamsSchema` (`{ width?: number; height?: number }`)
  - `ToolMock`, `MockConfig`
  - `WidgetSource`
  - `RpcDirection`, `RpcLogEvent`

- [x] **Step 1: Write failing test** (`src/host-context.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { defaultHostContext, hostContextSchema } from './host-context.js';
import { MCP_APPS_METHODS, MCP_APPS_PROTOCOL_VERSION, toolsCallParamsSchema } from './protocol.js';

describe('hostContextSchema', () => {
  it('accepts the default context', () => {
    expect(hostContextSchema.safeParse(defaultHostContext).success).toBe(true);
  });

  it('accepts full spec-shaped context', () => {
    const full = {
      theme: 'dark',
      locale: 'en-US',
      displayMode: 'inline',
      containerDimensions: { width: 400, maxHeight: 600 },
      styles: { variables: { '--color-background-primary': '#fff' }, css: { fonts: '@font-face {}' } },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    expect(hostContextSchema.safeParse(full).success).toBe(true);
  });

  it('rejects unknown theme', () => {
    expect(hostContextSchema.safeParse({ ...defaultHostContext, theme: 'sepia' }).success).toBe(false);
  });
});

describe('protocol constants', () => {
  it('pins spec version and method names', () => {
    expect(MCP_APPS_PROTOCOL_VERSION).toBe('2026-01-26');
    expect(MCP_APPS_METHODS.hostContextChanged).toBe('ui/notifications/host-context-changed');
  });

  it('validates tools/call params', () => {
    expect(toolsCallParamsSchema.safeParse({ name: 'get_metrics', arguments: { q: 1 } }).success).toBe(true);
    expect(toolsCallParamsSchema.safeParse({ arguments: {} }).success).toBe(false);
  });
});
```

- [x] **Step 2: Run, verify FAIL**

- [x] **Step 3: Implement**

`src/host-context.ts`:
```ts
import { z } from 'zod';

export const hostContextSchema = z.object({
  theme: z.enum(['light', 'dark']),
  locale: z.string(),
  displayMode: z.enum(['inline', 'fullscreen', 'pip']),
  containerDimensions: z.object({ width: z.number(), maxHeight: z.number() }).optional(),
  styles: z
    .object({
      variables: z.record(z.string(), z.string()).optional(),
      css: z.object({ fonts: z.string().optional() }).optional(),
    })
    .optional(),
  safeAreaInsets: z
    .object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() })
    .optional(),
});
export type HostContext = z.infer<typeof hostContextSchema>;

export const defaultHostContext: HostContext = {
  theme: 'light',
  locale: 'en',
  displayMode: 'inline',
};
```

`src/protocol.ts`:
```ts
import { z } from 'zod';

export const MCP_APPS_PROTOCOL_VERSION = '2026-01-26';

/**
 * Wire method names for the MCP Apps extension (SEP-1865), spec 2026-01-26.
 * Single source of truth — adjust here when the spec evolves.
 */
export const MCP_APPS_METHODS = {
  // View → Host
  uiInitialize: 'ui/initialize',
  toolsCall: 'tools/call',
  resourcesRead: 'resources/read',
  sizeChanged: 'ui/notifications/size-changed',
  // Host → View
  hostContextChanged: 'ui/notifications/host-context-changed',
  toolInput: 'ui/notifications/tool-input',
} as const;

export const toolsCallParamsSchema = z.object({
  name: z.string().min(1),
  arguments: z.unknown().optional(),
});

export const resourcesReadParamsSchema = z.object({
  uri: z.string().min(1),
});

export const sizeChangedParamsSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
});
```

`src/mocks.ts`:
```ts
export type ToolMock =
  | { kind: 'static'; result: unknown; delayMs?: number }
  | { kind: 'error'; error: { code: number; message: string }; delayMs?: number }
  | { kind: 'passthrough' };

export type MockConfig = Record<string, ToolMock>;
```

`src/widget.ts`:
```ts
export type WidgetSource =
  | { kind: 'resource'; uri: string; html: string }
  | { kind: 'dev'; url: string };
```

`src/rpc-log.ts`:
```ts
import type { JsonRpcId } from './json-rpc.js';

export type RpcDirection = 'widget→host' | 'host→widget';

export interface RpcLogEvent {
  ts: number;
  direction: RpcDirection;
  kind: 'request' | 'notification' | 'response' | 'invalid';
  method?: string;
  id?: JsonRpcId;
  payload: unknown;
  error?: string;
}
```

`src/index.ts` (replace):
```ts
export * from './json-rpc.js';
export * from './host-context.js';
export * from './protocol.js';
export * from './mocks.js';
export * from './widget.js';
export * from './rpc-log.js';
```

- [x] **Step 4: Run tests + typecheck** — `pnpm vitest run packages/shared && pnpm -F @studio/shared typecheck` → PASS

- [x] **Step 5: Commit** — `git commit -m "feat(shared): host context, protocol constants, mocks, widget, rpc-log types"`

---

### Task 4: host-emulator — Transport + MessageBridge

**Files:**
- Create: `packages/host-emulator/package.json`, `packages/host-emulator/tsconfig.json`, `packages/host-emulator/src/index.ts`, `packages/host-emulator/src/errors.ts`, `packages/host-emulator/src/transport.ts`, `packages/host-emulator/src/message-bridge.ts`
- Test: `packages/host-emulator/src/message-bridge.test.ts`

**Interfaces:**
- Consumes: `parseJsonRpcMessage`, `ERROR_CODES`, `RpcLogEvent`, `JsonRpcRequest`, `JsonRpcNotification`, `JsonRpcId` from `@studio/shared`.
- Produces:
  - `class RpcError extends Error { code: number; data?: unknown }`
  - `interface Transport { send(message: unknown): void; onMessage(handler: (message: unknown) => void): () => void }`
  - `createInMemoryTransportPair(): [Transport, Transport]` (async delivery via `queueMicrotask`)
  - `class MessageBridge`:
    - `constructor(opts: { transport: Transport; onRequest: (req: JsonRpcRequest) => Promise<unknown>; onNotification?: (n: JsonRpcNotification) => void; onLog?: (ev: RpcLogEvent) => void; requestTimeoutMs?: number; now?: () => number })`
    - `start(): void`, `stop(): void`
    - `request(method: string, params?: unknown): Promise<unknown>`
    - `notify(method: string, params?: unknown): void`

- [x] **Step 1: Package skeleton**

`packages/host-emulator/package.json`:
```json
{
  "name": "@studio/host-emulator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@studio/shared": "workspace:*",
    "zod": "^4.0.0"
  },
  "devDependencies": { "typescript": "~5.8.0" }
}
```

`packages/host-emulator/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Run `pnpm install` to link workspace dep.

- [x] **Step 2: Write failing test** (`src/message-bridge.test.ts`)

```ts
import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES, type RpcLogEvent } from '@studio/shared';
import { RpcError } from './errors.js';
import { MessageBridge } from './message-bridge.js';
import { createInMemoryTransportPair, type Transport } from './transport.js';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function widgetSide(t: Transport) {
  const received: unknown[] = [];
  t.onMessage((m) => received.push(m));
  return { received, send: (m: unknown) => t.send(m) };
}

describe('MessageBridge', () => {
  it('dispatches incoming widget request to onRequest and responds with result', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    const widget = widgetSide(widgetT);
    const bridge = new MessageBridge({
      transport: hostT,
      onRequest: async (req) => ({ echoed: req.method }),
    });
    bridge.start();
    widget.send({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 't' } });
    await flush();
    expect(widget.received).toEqual([{ jsonrpc: '2.0', id: 7, result: { echoed: 'tools/call' } }]);
  });

  it('maps RpcError thrown by onRequest to a JSON-RPC error response', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    const widget = widgetSide(widgetT);
    const bridge = new MessageBridge({
      transport: hostT,
      onRequest: async () => {
        throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, 'no such method');
      },
    });
    bridge.start();
    widget.send({ jsonrpc: '2.0', id: 1, method: 'nope' });
    await flush();
    expect(widget.received).toEqual([
      { jsonrpc: '2.0', id: 1, error: { code: ERROR_CODES.METHOD_NOT_FOUND, message: 'no such method' } },
    ]);
  });

  it('resolves host-originated request with widget response', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    widgetT.onMessage((m) => {
      const msg = m as { id: unknown; method: string };
      if (msg.method === 'ping') widgetT.send({ jsonrpc: '2.0', id: msg.id, result: 'pong' });
    });
    const bridge = new MessageBridge({ transport: hostT, onRequest: async () => null });
    bridge.start();
    await expect(bridge.request('ping')).resolves.toBe('pong');
  });

  it('logs invalid messages and keeps working', async () => {
    const log: RpcLogEvent[] = [];
    const [hostT, widgetT] = createInMemoryTransportPair();
    const widget = widgetSide(widgetT);
    const bridge = new MessageBridge({
      transport: hostT,
      onRequest: async () => 'ok',
      onLog: (ev) => log.push(ev),
    });
    bridge.start();
    widget.send({ evil: true });
    widget.send({ jsonrpc: '2.0', id: 2, method: 'still/works' });
    await flush();
    expect(log.some((e) => e.kind === 'invalid')).toBe(true);
    expect(widget.received).toEqual([{ jsonrpc: '2.0', id: 2, result: 'ok' }]);
  });

  it('logs directions for request/response pairs', async () => {
    const log: RpcLogEvent[] = [];
    const [hostT, widgetT] = createInMemoryTransportPair();
    widgetSide(widgetT).send; // keep widget listening
    const bridge = new MessageBridge({
      transport: hostT,
      onRequest: async () => 'ok',
      onLog: (ev) => log.push(ev),
      now: () => 123,
    });
    bridge.start();
    widgetT.send({ jsonrpc: '2.0', id: 3, method: 'tools/call' });
    await flush();
    expect(log.map((e) => [e.direction, e.kind])).toEqual([
      ['widget→host', 'request'],
      ['host→widget', 'response'],
    ]);
    expect(log[0]?.ts).toBe(123);
  });

  it('times out host-originated requests', async () => {
    vi.useFakeTimers();
    try {
      const [hostT] = createInMemoryTransportPair();
      const bridge = new MessageBridge({ transport: hostT, onRequest: async () => null, requestTimeoutMs: 1000 });
      bridge.start();
      const p = bridge.request('ping');
      const assertion = expect(p).rejects.toMatchObject({ code: ERROR_CODES.REQUEST_TIMEOUT });
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() unsubscribes and rejects pending requests', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    const widget = widgetSide(widgetT);
    const bridge = new MessageBridge({ transport: hostT, onRequest: async () => 'ok' });
    bridge.start();
    const p = bridge.request('ping');
    const assertion = expect(p).rejects.toBeInstanceOf(RpcError);
    bridge.stop();
    await assertion;
    widget.send({ jsonrpc: '2.0', id: 9, method: 'tools/call' });
    await flush();
    // only the original 'ping' request reached the widget; no response after stop
    expect(widget.received).toHaveLength(1);
  });
});
```

- [x] **Step 3: Run, verify FAIL**

- [x] **Step 4: Implement**

`src/errors.ts`:
```ts
export class RpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}
```

`src/transport.ts`:
```ts
export interface Transport {
  send(message: unknown): void;
  onMessage(handler: (message: unknown) => void): () => void;
}

type Handler = (message: unknown) => void;

export function createInMemoryTransportPair(): [Transport, Transport] {
  const a = new Set<Handler>();
  const b = new Set<Handler>();
  const make = (own: Set<Handler>, peer: Set<Handler>): Transport => ({
    send(message) {
      queueMicrotask(() => {
        for (const h of peer) h(message);
      });
    },
    onMessage(handler) {
      own.add(handler);
      return () => own.delete(handler);
    },
  });
  return [make(a, b), make(b, a)];
}
```

`src/message-bridge.ts`:
```ts
import {
  ERROR_CODES,
  JSON_RPC_VERSION,
  parseJsonRpcMessage,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type RpcLogEvent,
} from '@studio/shared';
import { RpcError } from './errors.js';
import type { Transport } from './transport.js';

export interface MessageBridgeOptions {
  transport: Transport;
  /** Handles widget-originated requests; return value becomes the JSON-RPC result. Throw RpcError for protocol errors. */
  onRequest: (req: JsonRpcRequest) => Promise<unknown>;
  onNotification?: (n: JsonRpcNotification) => void;
  onLog?: (ev: RpcLogEvent) => void;
  requestTimeoutMs?: number;
  now?: () => number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class MessageBridge {
  private readonly pending = new Map<JsonRpcId, Pending>();
  private unsubscribe: (() => void) | null = null;
  private counter = 0;

  constructor(private readonly opts: MessageBridgeOptions) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.opts.transport.onMessage((raw) => void this.handleIncoming(raw));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new RpcError(ERROR_CODES.INTERNAL_ERROR, 'bridge stopped'));
    }
    this.pending.clear();
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = `h${++this.counter}`;
    const msg = { jsonrpc: JSON_RPC_VERSION, id, method, ...(params !== undefined ? { params } : {}) };
    this.log({ direction: 'host→widget', kind: 'request', method, id, payload: msg });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcError(ERROR_CODES.REQUEST_TIMEOUT, `Request "${method}" timed out`));
      }, this.opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.opts.transport.send(msg);
    });
  }

  notify(method: string, params?: unknown): void {
    const msg = { jsonrpc: JSON_RPC_VERSION, method, ...(params !== undefined ? { params } : {}) };
    this.log({ direction: 'host→widget', kind: 'notification', method, payload: msg });
    this.opts.transport.send(msg);
  }

  private log(ev: Omit<RpcLogEvent, 'ts'>): void {
    this.opts.onLog?.({ ts: (this.opts.now ?? Date.now)(), ...ev });
  }

  private async handleIncoming(raw: unknown): Promise<void> {
    const parsed = parseJsonRpcMessage(raw);
    if (!parsed.ok) {
      this.log({ direction: 'widget→host', kind: 'invalid', payload: raw, error: parsed.error });
      return;
    }
    switch (parsed.kind) {
      case 'request':
        return this.handleRequest(parsed.message);
      case 'notification':
        this.log({ direction: 'widget→host', kind: 'notification', method: parsed.message.method, payload: parsed.message });
        this.opts.onNotification?.(parsed.message);
        return;
      case 'response':
        return this.handleResponse(parsed.message);
    }
  }

  private async handleRequest(req: JsonRpcRequest): Promise<void> {
    this.log({ direction: 'widget→host', kind: 'request', method: req.method, id: req.id, payload: req });
    let response: Record<string, unknown>;
    try {
      const result = await this.opts.onRequest(req);
      response = { jsonrpc: JSON_RPC_VERSION, id: req.id, result };
    } catch (err) {
      const rpcErr =
        err instanceof RpcError ? err : new RpcError(ERROR_CODES.INTERNAL_ERROR, err instanceof Error ? err.message : String(err));
      response = {
        jsonrpc: JSON_RPC_VERSION,
        id: req.id,
        error: { code: rpcErr.code, message: rpcErr.message, ...(rpcErr.data !== undefined ? { data: rpcErr.data } : {}) },
      };
    }
    if (!this.unsubscribe) return; // stopped while handling
    this.log({ direction: 'host→widget', kind: 'response', id: req.id, payload: response });
    this.opts.transport.send(response);
  }

  private handleResponse(msg: JsonRpcResponse): void {
    const id = msg.id;
    const pending = id === null ? undefined : this.pending.get(id);
    if (!pending || id === null) {
      this.log({ direction: 'widget→host', kind: 'invalid', payload: msg, error: `unexpected response id: ${String(id)}` });
      return;
    }
    this.pending.delete(id);
    clearTimeout(pending.timer);
    this.log({ direction: 'widget→host', kind: 'response', id, payload: msg });
    if ('error' in msg) {
      pending.reject(new RpcError(msg.error.code, msg.error.message, msg.error.data));
    } else {
      pending.resolve(msg.result);
    }
  }
}
```

`src/index.ts`:
```ts
export * from './errors.js';
export * from './transport.js';
export * from './message-bridge.js';
```

- [x] **Step 5: Run, verify PASS** — `pnpm vitest run packages/host-emulator && pnpm -F @studio/host-emulator typecheck`

- [x] **Step 6: Commit** — `git commit -m "feat(host-emulator): transport abstraction and validating JSON-RPC message bridge"`

---

### Task 5: host-emulator — MockRouter

**Files:**
- Create: `packages/host-emulator/src/mock-router.ts`
- Modify: `packages/host-emulator/src/index.ts`
- Test: `packages/host-emulator/src/mock-router.test.ts`

**Interfaces:**
- Consumes: `MockConfig`, `ToolMock`, `ERROR_CODES` from shared; `RpcError`.
- Produces:
  - `type PassthroughHandler = (toolName: string, args: unknown) => Promise<unknown>`
  - `class MockRouter { constructor(config?: MockConfig, passthrough?: PassthroughHandler); call(toolName: string, args: unknown): Promise<unknown>; setConfig(config: MockConfig): void }`

- [x] **Step 1: Write failing test** (`src/mock-router.test.ts`)

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '@studio/shared';
import { MockRouter } from './mock-router.js';

afterEach(() => vi.useRealTimers());

describe('MockRouter', () => {
  it('returns static mock result', async () => {
    const router = new MockRouter({ get_metrics: { kind: 'static', result: { rows: [1] } } });
    await expect(router.call('get_metrics', {})).resolves.toEqual({ rows: [1] });
  });

  it('throws RpcError for error mock', async () => {
    const router = new MockRouter({ get_metrics: { kind: 'error', error: { code: -32000, message: 'boom' } } });
    await expect(router.call('get_metrics', {})).rejects.toMatchObject({ code: -32000, message: 'boom' });
  });

  it('applies delayMs before resolving', async () => {
    vi.useFakeTimers();
    const router = new MockRouter({ slow: { kind: 'static', result: 'done', delayMs: 500 } });
    const p = router.call('slow', {});
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await expect(p).resolves.toBe('done');
  });

  it('routes passthrough kind and unmocked tools to passthrough handler', async () => {
    const passthrough = vi.fn().mockResolvedValue('real');
    const router = new MockRouter({ proxied: { kind: 'passthrough' } }, passthrough);
    await expect(router.call('proxied', { a: 1 })).resolves.toBe('real');
    await expect(router.call('unmocked', {})).resolves.toBe('real');
    expect(passthrough).toHaveBeenCalledWith('proxied', { a: 1 });
  });

  it('throws METHOD_NOT_FOUND when no mock and no passthrough', async () => {
    const router = new MockRouter({});
    await expect(router.call('ghost', {})).rejects.toMatchObject({ code: ERROR_CODES.METHOD_NOT_FOUND });
  });

  it('setConfig replaces mocks', async () => {
    const router = new MockRouter({});
    router.setConfig({ t: { kind: 'static', result: 1 } });
    await expect(router.call('t', {})).resolves.toBe(1);
  });
});
```

- [x] **Step 2: Run, verify FAIL**

- [x] **Step 3: Implement** (`src/mock-router.ts`)

```ts
import { ERROR_CODES, type MockConfig } from '@studio/shared';
import { RpcError } from './errors.js';

export type PassthroughHandler = (toolName: string, args: unknown) => Promise<unknown>;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class MockRouter {
  constructor(
    private config: MockConfig = {},
    private readonly passthrough?: PassthroughHandler,
  ) {}

  setConfig(config: MockConfig): void {
    this.config = config;
  }

  async call(toolName: string, args: unknown): Promise<unknown> {
    const mock = this.config[toolName];
    if (!mock || mock.kind === 'passthrough') {
      if (!this.passthrough) {
        throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `No mock or passthrough for tool "${toolName}"`);
      }
      return this.passthrough(toolName, args);
    }
    if (mock.delayMs) await delay(mock.delayMs);
    if (mock.kind === 'error') {
      throw new RpcError(mock.error.code, mock.error.message);
    }
    return mock.result;
  }
}
```

Add to `src/index.ts`:
```ts
export * from './mock-router.js';
```

- [x] **Step 4: Run, verify PASS**

- [x] **Step 5: Commit** — `git commit -m "feat(host-emulator): mock router for tool calls (static/error/delay/passthrough)"`

---

### Task 6: host-emulator — HostAdapter interface + McpAppsAdapter

**Files:**
- Create: `packages/host-emulator/src/adapter.ts`, `packages/host-emulator/src/mcp-apps-adapter.ts`
- Modify: `packages/host-emulator/src/index.ts`
- Test: `packages/host-emulator/src/mcp-apps-adapter.test.ts`

**Interfaces:**
- Consumes: `HostContext`, `WidgetSource`, `MCP_APPS_METHODS`, `MCP_APPS_PROTOCOL_VERSION`, params schemas, `JsonRpcRequest`, `JsonRpcNotification`, `JsonRpcId` from shared.
- Produces (`src/adapter.ts`):
  - `type AdapterId = 'mcp-apps' | 'openai-apps' | 'mcp-ui-legacy'`
  - `interface IframeEnv { mode: 'srcdoc' | 'src'; content: string; sandbox: string[]; csp?: string }`
  - `type AdapterAction = { type: 'initialize'; requestId: JsonRpcId } | { type: 'tool-call'; requestId: JsonRpcId; toolName: string; args: unknown } | { type: 'resource-read'; requestId: JsonRpcId; uri: string } | { type: 'size-changed'; width?: number; height?: number } | { type: 'invalid-params'; requestId: JsonRpcId; method: string; error: string } | { type: 'unsupported'; method: string; requestId?: JsonRpcId }`
  - `type HostEvent = { type: 'context-changed'; context: Partial<HostContext> }`
  - `interface HostCapabilities { displayModes: HostContext['displayMode'][] }`
  - `interface HostAdapter { readonly id: AdapterId; buildIframeEnv(widget: WidgetSource, ctx: HostContext): IframeEnv; handleWidgetMessage(msg: JsonRpcRequest | JsonRpcNotification): AdapterAction; pushHostEvent(ev: HostEvent): JsonRpcNotification | null; buildInitializeResult(ctx: HostContext): unknown; capabilities(): HostCapabilities }`
  - `class McpAppsAdapter implements HostAdapter`

- [x] **Step 1: Write failing test** (`src/mcp-apps-adapter.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { MCP_APPS_METHODS, MCP_APPS_PROTOCOL_VERSION, defaultHostContext } from '@studio/shared';
import { McpAppsAdapter } from './mcp-apps-adapter.js';

const adapter = new McpAppsAdapter();
const req = (id: number, method: string, params?: unknown) => ({ jsonrpc: '2.0' as const, id, method, params });

describe('McpAppsAdapter.handleWidgetMessage', () => {
  it('maps ui/initialize to initialize action', () => {
    expect(adapter.handleWidgetMessage(req(1, MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} }))).toEqual({
      type: 'initialize',
      requestId: 1,
    });
  });

  it('maps tools/call to tool-call action', () => {
    expect(adapter.handleWidgetMessage(req(2, MCP_APPS_METHODS.toolsCall, { name: 'get_metrics', arguments: { q: 1 } }))).toEqual({
      type: 'tool-call',
      requestId: 2,
      toolName: 'get_metrics',
      args: { q: 1 },
    });
  });

  it('maps malformed tools/call params to invalid-params', () => {
    const action = adapter.handleWidgetMessage(req(3, MCP_APPS_METHODS.toolsCall, { arguments: {} }));
    expect(action).toMatchObject({ type: 'invalid-params', requestId: 3, method: MCP_APPS_METHODS.toolsCall });
  });

  it('maps resources/read to resource-read', () => {
    expect(adapter.handleWidgetMessage(req(4, MCP_APPS_METHODS.resourcesRead, { uri: 'ui://kpi' }))).toEqual({
      type: 'resource-read',
      requestId: 4,
      uri: 'ui://kpi',
    });
  });

  it('maps size-changed notification', () => {
    expect(
      adapter.handleWidgetMessage({ jsonrpc: '2.0', method: MCP_APPS_METHODS.sizeChanged, params: { width: 300, height: 200 } }),
    ).toEqual({ type: 'size-changed', width: 300, height: 200 });
  });

  it('maps unknown method to unsupported', () => {
    expect(adapter.handleWidgetMessage(req(5, 'wat/ever'))).toEqual({ type: 'unsupported', method: 'wat/ever', requestId: 5 });
  });
});

describe('McpAppsAdapter host-side translation', () => {
  it('translates context-changed event to wire notification', () => {
    expect(adapter.pushHostEvent({ type: 'context-changed', context: { theme: 'dark' } })).toEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.hostContextChanged,
      params: { theme: 'dark' },
    });
  });

  it('builds spec-shaped initialize result', () => {
    expect(adapter.buildInitializeResult(defaultHostContext)).toMatchObject({
      protocolVersion: MCP_APPS_PROTOCOL_VERSION,
      hostInfo: { name: 'mcp-apps-studio' },
      hostContext: defaultHostContext,
    });
  });

  it('builds sandboxed iframe env for resource and dev widgets', () => {
    expect(adapter.buildIframeEnv({ kind: 'resource', uri: 'ui://kpi', html: '<html/>' }, defaultHostContext)).toEqual({
      mode: 'srcdoc',
      content: '<html/>',
      sandbox: ['allow-scripts'],
    });
    expect(adapter.buildIframeEnv({ kind: 'dev', url: 'http://localhost:5173/kpi' }, defaultHostContext)).toEqual({
      mode: 'src',
      content: 'http://localhost:5173/kpi',
      sandbox: ['allow-scripts'],
    });
  });
});
```

- [x] **Step 2: Run, verify FAIL**

- [x] **Step 3: Implement**

`src/adapter.ts`:
```ts
import type { HostContext, JsonRpcId, JsonRpcNotification, JsonRpcRequest, WidgetSource } from '@studio/shared';

export type AdapterId = 'mcp-apps' | 'openai-apps' | 'mcp-ui-legacy';

export interface IframeEnv {
  mode: 'srcdoc' | 'src';
  content: string;
  sandbox: string[];
  csp?: string;
}

export type AdapterAction =
  | { type: 'initialize'; requestId: JsonRpcId }
  | { type: 'tool-call'; requestId: JsonRpcId; toolName: string; args: unknown }
  | { type: 'resource-read'; requestId: JsonRpcId; uri: string }
  | { type: 'size-changed'; width?: number; height?: number }
  | { type: 'invalid-params'; requestId: JsonRpcId; method: string; error: string }
  | { type: 'unsupported'; method: string; requestId?: JsonRpcId };

export type HostEvent = { type: 'context-changed'; context: Partial<HostContext> };

export interface HostCapabilities {
  displayModes: HostContext['displayMode'][];
}

/**
 * Pure translator between wire messages and semantic actions.
 * No transport access, no side effects — testable against golden logs.
 */
export interface HostAdapter {
  readonly id: AdapterId;
  buildIframeEnv(widget: WidgetSource, ctx: HostContext): IframeEnv;
  handleWidgetMessage(msg: JsonRpcRequest | JsonRpcNotification): AdapterAction;
  pushHostEvent(ev: HostEvent): JsonRpcNotification | null;
  buildInitializeResult(ctx: HostContext): unknown;
  capabilities(): HostCapabilities;
}
```

`src/mcp-apps-adapter.ts`:
```ts
import {
  JSON_RPC_VERSION,
  MCP_APPS_METHODS,
  MCP_APPS_PROTOCOL_VERSION,
  resourcesReadParamsSchema,
  sizeChangedParamsSchema,
  toolsCallParamsSchema,
  type HostContext,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type WidgetSource,
} from '@studio/shared';
import type { AdapterAction, HostAdapter, HostCapabilities, HostEvent, IframeEnv } from './adapter.js';

function requestId(msg: JsonRpcRequest | JsonRpcNotification): JsonRpcId | undefined {
  return 'id' in msg ? msg.id : undefined;
}

export class McpAppsAdapter implements HostAdapter {
  readonly id = 'mcp-apps' as const;

  buildIframeEnv(widget: WidgetSource, _ctx: HostContext): IframeEnv {
    return widget.kind === 'resource'
      ? { mode: 'srcdoc', content: widget.html, sandbox: ['allow-scripts'] }
      : { mode: 'src', content: widget.url, sandbox: ['allow-scripts'] };
  }

  handleWidgetMessage(msg: JsonRpcRequest | JsonRpcNotification): AdapterAction {
    const id = requestId(msg);
    switch (msg.method) {
      case MCP_APPS_METHODS.uiInitialize:
        return { type: 'initialize', requestId: id ?? 0 };
      case MCP_APPS_METHODS.toolsCall: {
        const p = toolsCallParamsSchema.safeParse(msg.params);
        if (!p.success) return { type: 'invalid-params', requestId: id ?? 0, method: msg.method, error: p.error.message };
        return { type: 'tool-call', requestId: id ?? 0, toolName: p.data.name, args: p.data.arguments };
      }
      case MCP_APPS_METHODS.resourcesRead: {
        const p = resourcesReadParamsSchema.safeParse(msg.params);
        if (!p.success) return { type: 'invalid-params', requestId: id ?? 0, method: msg.method, error: p.error.message };
        return { type: 'resource-read', requestId: id ?? 0, uri: p.data.uri };
      }
      case MCP_APPS_METHODS.sizeChanged: {
        const p = sizeChangedParamsSchema.safeParse(msg.params);
        if (!p.success) return { type: 'unsupported', method: msg.method };
        return { type: 'size-changed', ...p.data };
      }
      default:
        return { type: 'unsupported', method: msg.method, ...(id !== undefined ? { requestId: id } : {}) };
    }
  }

  pushHostEvent(ev: HostEvent): JsonRpcNotification | null {
    if (ev.type === 'context-changed') {
      return { jsonrpc: JSON_RPC_VERSION, method: MCP_APPS_METHODS.hostContextChanged, params: ev.context };
    }
    return null;
  }

  buildInitializeResult(ctx: HostContext): unknown {
    return {
      protocolVersion: MCP_APPS_PROTOCOL_VERSION,
      hostCapabilities: {},
      hostInfo: { name: 'mcp-apps-studio', version: '0.1.0' },
      hostContext: ctx,
    };
  }

  capabilities(): HostCapabilities {
    return { displayModes: ['inline', 'fullscreen', 'pip'] };
  }
}
```

Add to `src/index.ts`:
```ts
export * from './adapter.js';
export * from './mcp-apps-adapter.js';
```

Note: `tool-call.args` may be `undefined` when the widget omits `arguments`; the test for tools/call passes explicit arguments. `toEqual` treats missing/undefined keys as equal.

- [x] **Step 4: Run, verify PASS**

- [x] **Step 5: Commit** — `git commit -m "feat(host-emulator): HostAdapter interface and SEP-1865 mcp-apps adapter"`

---

### Task 7: host-emulator — HostEmulator composition + integration test

**Files:**
- Create: `packages/host-emulator/src/host-emulator.ts`
- Modify: `packages/host-emulator/src/index.ts`
- Test: `packages/host-emulator/src/host-emulator.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `interface HostEmulatorOptions { adapter: HostAdapter; transport: Transport; mocks?: MockConfig; passthrough?: PassthroughHandler; resources?: Record<string, string>; hostContext?: HostContext; onLog?: (ev: RpcLogEvent) => void; onSizeChanged?: (size: { width?: number; height?: number }) => void }`
  - `class HostEmulator { start(); stop(); setHostContext(patch: Partial<HostContext>); setMocks(config: MockConfig); getHostContext(): HostContext }`

- [x] **Step 1: Write failing test** (`src/host-emulator.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, MCP_APPS_METHODS, MCP_APPS_PROTOCOL_VERSION, type RpcLogEvent } from '@studio/shared';
import { HostEmulator } from './host-emulator.js';
import { McpAppsAdapter } from './mcp-apps-adapter.js';
import { createInMemoryTransportPair, type Transport } from './transport.js';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/** Minimal fake widget speaking raw JSON-RPC, like a real iframe would. */
function fakeWidget(t: Transport) {
  const inbox: any[] = [];
  t.onMessage((m) => inbox.push(m));
  let nextId = 0;
  return {
    inbox,
    async request(method: string, params?: unknown) {
      const id = `w${++nextId}`;
      t.send({ jsonrpc: '2.0', id, method, params });
      await flush();
      return inbox.find((m) => m.id === id);
    },
    notify(method: string, params?: unknown) {
      t.send({ jsonrpc: '2.0', method, params });
    },
  };
}

function setup(opts: Partial<ConstructorParameters<typeof HostEmulator>[0]> = {}) {
  const [hostT, widgetT] = createInMemoryTransportPair();
  const log: RpcLogEvent[] = [];
  const emulator = new HostEmulator({
    adapter: new McpAppsAdapter(),
    transport: hostT,
    onLog: (ev) => log.push(ev),
    ...opts,
  });
  emulator.start();
  return { emulator, widget: fakeWidget(widgetT), log };
}

describe('HostEmulator', () => {
  it('answers ui/initialize with protocol version and host context', async () => {
    const { widget } = setup();
    const resp = await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
    expect(resp.result.protocolVersion).toBe(MCP_APPS_PROTOCOL_VERSION);
    expect(resp.result.hostContext.theme).toBe('light');
  });

  it('resolves tools/call from static mock', async () => {
    const { widget } = setup({ mocks: { get_metrics: { kind: 'static', result: { rows: [1, 2] } } } });
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 'get_metrics', arguments: {} });
    expect(resp.result).toEqual({ rows: [1, 2] });
  });

  it('returns JSON-RPC error for error mock', async () => {
    const { widget } = setup({ mocks: { get_metrics: { kind: 'error', error: { code: -32000, message: 'db down' } } } });
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 'get_metrics' });
    expect(resp.error).toMatchObject({ code: -32000, message: 'db down' });
  });

  it('serves resources/read from configured resources', async () => {
    const { widget } = setup({ resources: { 'ui://kpi': '<html>kpi</html>' } });
    const resp = await widget.request(MCP_APPS_METHODS.resourcesRead, { uri: 'ui://kpi' });
    expect(resp.result.contents[0]).toMatchObject({ uri: 'ui://kpi', text: '<html>kpi</html>' });
    const missing = await widget.request(MCP_APPS_METHODS.resourcesRead, { uri: 'ui://ghost' });
    expect(missing.error.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('pushes host-context-changed notification on setHostContext', async () => {
    const { emulator, widget } = setup();
    emulator.setHostContext({ theme: 'dark' });
    await flush();
    expect(widget.inbox).toContainEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.hostContextChanged,
      params: { theme: 'dark' },
    });
    expect(emulator.getHostContext().theme).toBe('dark');
  });

  it('reports size-changed notifications', async () => {
    const sizes: unknown[] = [];
    const { widget } = setup({ onSizeChanged: (s) => sizes.push(s) });
    widget.notify(MCP_APPS_METHODS.sizeChanged, { width: 320, height: 240 });
    await flush();
    expect(sizes).toEqual([{ width: 320, height: 240 }]);
  });

  it('rejects unsupported methods with METHOD_NOT_FOUND', async () => {
    const { widget } = setup();
    const resp = await widget.request('wat/ever');
    expect(resp.error.code).toBe(ERROR_CODES.METHOD_NOT_FOUND);
  });

  it('survives garbage messages and logs them as invalid', async () => {
    const { widget, log } = setup({ mocks: { t: { kind: 'static', result: 'ok' } } });
    widget.notify as unknown; // keep ts happy
    (widget as any).inbox; // noop
    // send raw garbage
    await widget.request(MCP_APPS_METHODS.toolsCall, { name: 't' }); // warm-up valid call
    const before = log.filter((e) => e.kind === 'invalid').length;
    // garbage: not JSON-RPC at all
    (widget as any).notify; // noop
    await (async () => {
      const [hostT2] = [null];
      void hostT2;
    })();
    expect(before).toBe(0);
  });
});
```

Replace the last test with a simpler, honest version (no dead code):

```ts
  it('survives garbage messages and logs them as invalid', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    const log: RpcLogEvent[] = [];
    const emulator = new HostEmulator({
      adapter: new McpAppsAdapter(),
      transport: hostT,
      mocks: { t: { kind: 'static', result: 'ok' } },
      onLog: (ev) => log.push(ev),
    });
    emulator.start();
    const widget = fakeWidget(widgetT);
    widgetT.send({ totally: 'garbage' });
    await flush();
    expect(log.filter((e) => e.kind === 'invalid')).toHaveLength(1);
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 't' });
    expect(resp.result).toBe('ok');
  });
```

- [x] **Step 2: Run, verify FAIL**

- [x] **Step 3: Implement** (`src/host-emulator.ts`)

```ts
import {
  ERROR_CODES,
  defaultHostContext,
  type HostContext,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type MockConfig,
  type RpcLogEvent,
} from '@studio/shared';
import type { HostAdapter } from './adapter.js';
import { RpcError } from './errors.js';
import { MessageBridge } from './message-bridge.js';
import { MockRouter, type PassthroughHandler } from './mock-router.js';
import type { Transport } from './transport.js';

export interface HostEmulatorOptions {
  adapter: HostAdapter;
  transport: Transport;
  mocks?: MockConfig;
  passthrough?: PassthroughHandler;
  /** uri → text content served for resources/read */
  resources?: Record<string, string>;
  hostContext?: HostContext;
  onLog?: (ev: RpcLogEvent) => void;
  onSizeChanged?: (size: { width?: number; height?: number }) => void;
}

export class HostEmulator {
  private readonly bridge: MessageBridge;
  private readonly mockRouter: MockRouter;
  private context: HostContext;

  constructor(private readonly opts: HostEmulatorOptions) {
    this.context = opts.hostContext ?? defaultHostContext;
    this.mockRouter = new MockRouter(opts.mocks ?? {}, opts.passthrough);
    this.bridge = new MessageBridge({
      transport: opts.transport,
      onRequest: (req) => this.handleRequest(req),
      onNotification: (n) => this.handleNotification(n),
      onLog: opts.onLog,
    });
  }

  start(): void {
    this.bridge.start();
  }

  stop(): void {
    this.bridge.stop();
  }

  getHostContext(): HostContext {
    return this.context;
  }

  setHostContext(patch: Partial<HostContext>): void {
    this.context = { ...this.context, ...patch };
    const wire = this.opts.adapter.pushHostEvent({ type: 'context-changed', context: patch });
    if (wire) this.bridge.notify(wire.method, wire.params);
  }

  setMocks(config: MockConfig): void {
    this.mockRouter.setConfig(config);
  }

  private async handleRequest(req: JsonRpcRequest): Promise<unknown> {
    const action = this.opts.adapter.handleWidgetMessage(req);
    switch (action.type) {
      case 'initialize':
        return this.opts.adapter.buildInitializeResult(this.context);
      case 'tool-call':
        return this.mockRouter.call(action.toolName, action.args);
      case 'resource-read': {
        const text = this.opts.resources?.[action.uri];
        if (text === undefined) {
          throw new RpcError(ERROR_CODES.RESOURCE_NOT_FOUND, `Unknown resource: ${action.uri}`);
        }
        return { contents: [{ uri: action.uri, mimeType: 'text/html', text }] };
      }
      case 'invalid-params':
        throw new RpcError(ERROR_CODES.INVALID_PARAMS, action.error);
      case 'unsupported':
        throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `Unsupported method: ${action.method}`);
      default:
        throw new RpcError(ERROR_CODES.INTERNAL_ERROR, `Request produced non-request action: ${(action as { type: string }).type}`);
    }
  }

  private handleNotification(n: JsonRpcNotification): void {
    const action = this.opts.adapter.handleWidgetMessage(n);
    if (action.type === 'size-changed') {
      this.opts.onSizeChanged?.({ width: action.width, height: action.height });
    }
  }
}
```

Add to `src/index.ts`:
```ts
export * from './host-emulator.js';
```

- [x] **Step 4: Run full suite + typecheck** — `pnpm test && pnpm typecheck` → all PASS

- [x] **Step 5: Commit** — `git commit -m "feat(host-emulator): HostEmulator composing bridge, adapter, mocks and resources"`

---

## Self-Review Notes

- Spec coverage: scaffold (T1), shared types/schemas (T2–3), bridge with zod validation of untrusted input (T4), mock layer static/error/delay/passthrough (T5), adapter interface + SEP-1865 adapter incl. iframe env & capabilities (T6), composed emulator with resources + context push + logging (T7). Deferred per MVP cuts: server-api, docs, e2e, other adapters, DOM iframe manager (needs browser; studio phase).
- Type consistency: `RpcLogEvent.ts` stamped in bridge via injectable `now`; `AdapterAction`/`HostEvent` names match between T6 and T7.
- `onSizeChanged` returns explicit `{width, height}` object (not the action) so the action type never leaks to studio consumers.
