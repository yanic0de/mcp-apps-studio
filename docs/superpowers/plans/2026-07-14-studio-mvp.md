# Studio MVP + Iframe Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real DOM transport for the host emulator (`IframeTransport` with `event.source` trust check) and a minimal working studio SPA: canvas with sandboxed demo widget, live RPC trace panel, host context controls, mock scenario switcher.

**Architecture:** `IframeTransport` implements the existing `Transport` interface against duck-typed window interfaces (unit-testable in node, no jsdom). The studio is a Vite+React 19 SPA; Zustand holds ephemeral UI state (host context, scenario, RPC log). The Canvas component remounts the iframe per scenario (`key={scenario}`) and wires `HostEmulator` + `IframeTransport` to it. A self-contained demo widget (raw HTML, inline script speaking JSON-RPC over postMessage) exercises the full protocol: handshake, tool call, theme push, size-changed.

**Tech Stack:** React 19, Vite 6, Zustand 5, plain CSS with design tokens (Tailwind deferred until component library phase).

## Global Constraints

- Same constraints as phase 1 plan (zod-validate untrusted input, `@studio/` scope, ESM, src exports).
- `IframeTransport` MUST drop messages whose `event.source` is not this iframe's `contentWindow` — sandboxed widgets have a null origin, source identity is the only trust signal (architecture doc §9).
- Studio chrome is always dark (instrument aesthetic); only the widget responds to the theme control.
- Design tokens: bg `#14171F`, panel `#1B2029`, line `#2A3140`, text `#E8EAF0`, muted `#8A93A6`, widget→host `#7AD3E6`, host→widget `#F0A868`, error `#E06C75`; protocol text in `ui-monospace` stack.
- Root vitest include widens to `{packages,apps}/*/src/**/*.test.ts`.

---

### Task 1: IframeTransport (host-emulator)

**Files:**
- Create: `packages/host-emulator/src/iframe-transport.ts`
- Modify: `packages/host-emulator/src/index.ts`
- Test: `packages/host-emulator/src/iframe-transport.test.ts`

**Interfaces:**
- Consumes: `Transport` from `./transport.js`.
- Produces: `class IframeTransport implements Transport { constructor(iframe: IframeLike, listeningWindow?: ListeningWindow); send; onMessage; dispose(): void }`, `interface IframeLike { readonly contentWindow: { postMessage(m: unknown, targetOrigin: string): void } | null }`.

- [x] **Step 1: Failing test** — fakes, no jsdom:

```ts
import { describe, expect, it, vi } from 'vitest';
import { IframeTransport, type IframeLike, type ListeningWindow } from './iframe-transport.js';

function fakeEnv() {
  const listeners = new Set<(ev: MessageEvent) => void>();
  const win: ListeningWindow = {
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  const contentWindow = { postMessage: vi.fn() };
  const iframe: IframeLike = { contentWindow };
  const emit = (source: unknown, data: unknown) => {
    for (const l of [...listeners]) l({ source, data } as unknown as MessageEvent);
  };
  return { win, iframe, contentWindow, emit, listeners };
}

describe('IframeTransport', () => {
  it('sends via contentWindow.postMessage with wildcard origin', () => {
    const { win, iframe, contentWindow } = fakeEnv();
    new IframeTransport(iframe, win).send({ a: 1 });
    expect(contentWindow.postMessage).toHaveBeenCalledWith({ a: 1 }, '*');
  });

  it('delivers only messages whose source is this iframe contentWindow', () => {
    const { win, iframe, contentWindow, emit } = fakeEnv();
    const t = new IframeTransport(iframe, win);
    const got: unknown[] = [];
    t.onMessage((m) => got.push(m));
    emit(contentWindow, { ok: 1 });
    emit({ postMessage: vi.fn() }, { evil: 1 }); // another window
    emit(null, { evil: 2 });
    expect(got).toEqual([{ ok: 1 }]);
  });

  it('ignores messages when contentWindow is null (iframe unmounted)', () => {
    const listeners = new Set<(ev: MessageEvent) => void>();
    const win: ListeningWindow = {
      addEventListener: (_t, l) => void listeners.add(l),
      removeEventListener: (_t, l) => void listeners.delete(l),
    };
    const iframe: IframeLike = { contentWindow: null };
    const t = new IframeTransport(iframe, win);
    const got: unknown[] = [];
    t.onMessage((m) => got.push(m));
    for (const l of listeners) l({ source: null, data: { x: 1 } } as unknown as MessageEvent);
    expect(got).toEqual([]);
    expect(() => t.send({ a: 1 })).not.toThrow();
  });

  it('unsubscribe and dispose stop delivery', () => {
    const { win, iframe, contentWindow, emit, listeners } = fakeEnv();
    const t = new IframeTransport(iframe, win);
    const got: unknown[] = [];
    const off = t.onMessage((m) => got.push(m));
    off();
    emit(contentWindow, { x: 1 });
    expect(got).toEqual([]);
    t.dispose();
    expect(listeners.size).toBe(0);
  });
});
```

- [x] **Step 2: verify FAIL** → **Step 3: implement**

```ts
import type { Transport } from './transport.js';

interface MessageSource {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface IframeLike {
  readonly contentWindow: MessageSource | null;
}

export interface ListeningWindow {
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
}

/**
 * Host-side transport bound to a sandboxed iframe. Sandboxed widgets run with a
 * null origin, so postMessage must use targetOrigin '*' and the ONLY trust
 * signal for incoming messages is `event.source === iframe.contentWindow`.
 */
export class IframeTransport implements Transport {
  private readonly handlers = new Set<(message: unknown) => void>();
  private readonly listener: (ev: MessageEvent) => void;

  constructor(
    private readonly iframe: IframeLike,
    private readonly listeningWindow: ListeningWindow = window,
  ) {
    this.listener = (ev) => {
      const cw = this.iframe.contentWindow;
      if (!cw || ev.source !== cw) return;
      for (const h of [...this.handlers]) h(ev.data);
    };
    this.listeningWindow.addEventListener('message', this.listener);
  }

  send(message: unknown): void {
    this.iframe.contentWindow?.postMessage(message, '*');
  }

  onMessage(handler: (message: unknown) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  dispose(): void {
    this.listeningWindow.removeEventListener('message', this.listener);
    this.handlers.clear();
  }
}
```

Add `export * from './iframe-transport.js';` to `src/index.ts`.

- [x] **Step 4: PASS + typecheck** → **Step 5: commit** `feat(host-emulator): iframe transport with event.source trust check`

---

### Task 2: Studio scaffold + store

**Files:**
- Create: `apps/studio/package.json`, `apps/studio/tsconfig.json`, `apps/studio/vite.config.ts`, `apps/studio/index.html`, `apps/studio/src/main.tsx`, `apps/studio/src/App.tsx` (placeholder), `apps/studio/src/store.ts`, `apps/studio/src/styles.css` (tokens)
- Modify: root `vitest.config.ts` (include apps)
- Test: `apps/studio/src/store.test.ts`

**Interfaces:**
- Produces: `useStudioStore` (zustand) with `{ hostContext, scenario, log, setHostContext(patch), setScenario(id), appendLog(ev), clearLog() }`; `scenarios: Record<ScenarioId, MockConfig>` with `default | loading | error`; `ScenarioId`.

- [x] **Step 1: Package skeleton**

`apps/studio/package.json`:
```json
{
  "name": "@studio/app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@studio/host-emulator": "workspace:*",
    "@studio/shared": "workspace:*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
    "typescript": "~5.8.0",
    "vite": "^6.3.0"
  }
}
```

`apps/studio/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`apps/studio/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
});
```

`apps/studio/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MCP Apps Studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/studio/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Root `vitest.config.ts` include → `['{packages,apps}/*/src/**/*.test.ts']`.

- [x] **Step 2: Failing store test** (`src/store.test.ts`)

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultHostContext } from '@studio/shared';
import { scenarios, useStudioStore } from './store.js';

const initial = useStudioStore.getState();

beforeEach(() => useStudioStore.setState(initial, true));

describe('studio store', () => {
  it('starts with default context and empty log', () => {
    const s = useStudioStore.getState();
    expect(s.hostContext).toEqual(defaultHostContext);
    expect(s.scenario).toBe('default');
    expect(s.log).toEqual([]);
  });

  it('merges host context patches', () => {
    useStudioStore.getState().setHostContext({ theme: 'dark' });
    expect(useStudioStore.getState().hostContext).toMatchObject({ theme: 'dark', locale: 'en' });
  });

  it('appends and clears log', () => {
    const ev = { ts: 1, direction: 'widget→host', kind: 'request', payload: {} } as const;
    useStudioStore.getState().appendLog(ev);
    expect(useStudioStore.getState().log).toHaveLength(1);
    useStudioStore.getState().clearLog();
    expect(useStudioStore.getState().log).toEqual([]);
  });

  it('switching scenario clears the log', () => {
    useStudioStore.getState().appendLog({ ts: 1, direction: 'widget→host', kind: 'request', payload: {} });
    useStudioStore.getState().setScenario('error');
    expect(useStudioStore.getState().scenario).toBe('error');
    expect(useStudioStore.getState().log).toEqual([]);
  });

  it('defines mocks for all scenarios', () => {
    expect(Object.keys(scenarios)).toEqual(['default', 'loading', 'error']);
    expect(scenarios.error['get_metrics']).toMatchObject({ kind: 'error' });
  });
});
```

- [x] **Step 3: verify FAIL** → **Step 4: implement** (`src/store.ts`)

```ts
import { create } from 'zustand';
import { defaultHostContext, type HostContext, type MockConfig, type RpcLogEvent } from '@studio/shared';

export type ScenarioId = 'default' | 'loading' | 'error';

export const scenarios: Record<ScenarioId, MockConfig> = {
  default: {
    get_metrics: {
      kind: 'static',
      result: { value: 12840, delta: 8.3, label: 'Monthly active users' },
    },
  },
  loading: {
    get_metrics: {
      kind: 'static',
      result: { value: 12840, delta: 8.3, label: 'Monthly active users' },
      delayMs: 3_600_000,
    },
  },
  error: {
    get_metrics: {
      kind: 'error',
      error: { code: -32000, message: 'Metrics backend unavailable' },
    },
  },
};

interface StudioState {
  hostContext: HostContext;
  scenario: ScenarioId;
  log: RpcLogEvent[];
  setHostContext: (patch: Partial<HostContext>) => void;
  setScenario: (scenario: ScenarioId) => void;
  appendLog: (ev: RpcLogEvent) => void;
  clearLog: () => void;
}

export const useStudioStore = create<StudioState>()((set) => ({
  hostContext: defaultHostContext,
  scenario: 'default',
  log: [],
  setHostContext: (patch) => set((s) => ({ hostContext: { ...s.hostContext, ...patch } })),
  setScenario: (scenario) => set({ scenario, log: [] }),
  appendLog: (ev) => set((s) => ({ log: [...s.log, ev] })),
  clearLog: () => set({ log: [] }),
}));
```

Placeholder `src/App.tsx` (replaced in Task 4):
```tsx
export function App() {
  return <div>MCP Apps Studio</div>;
}
```

`src/styles.css` — full token system and layout styles (final version, Task 4 consumes it):

```css
:root {
  --bg: #14171f;
  --panel: #1b2029;
  --panel-raised: #212836;
  --line: #2a3140;
  --text: #e8eaf0;
  --muted: #8a93a6;
  --to-host: #7ad3e6;   /* widget → host */
  --to-widget: #f0a868; /* host → widget */
  --err: #e06c75;
  --mono: ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
  --sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; }

html, body, #root { height: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 14px;
}

.app {
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 1fr 380px;
  grid-template-areas: 'header header' 'canvas trace';
  height: 100%;
}

.header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}

.brand {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text);
}

.brand em {
  color: var(--to-host);
  font-style: normal;
}

.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
}

.control {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.control select,
.control button {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text);
  background: var(--panel-raised);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
}

.control select:focus-visible,
.control button:focus-visible {
  outline: 2px solid var(--to-host);
  outline-offset: 1px;
}

.canvas {
  grid-area: canvas;
  display: grid;
  place-items: center;
  overflow: auto;
  background:
    conic-gradient(var(--panel) 25%, transparent 0 50%, var(--panel) 0 75%, transparent 0)
    0 0 / 24px 24px;
}

.viewport {
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.viewport iframe {
  display: block;
  border: 0;
  width: 360px;
  height: 240px;
  background: #fff;
}

.trace {
  grid-area: trace;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--line);
  background: var(--panel);
  min-height: 0;
}

.trace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.trace-head button {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
  background: none;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
}

.trace-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  font-family: var(--mono);
  font-size: 12px;
}

.trace-empty {
  padding: 16px 12px;
  color: var(--muted);
}

.trace-row {
  border-bottom: 1px solid color-mix(in srgb, var(--line) 45%, transparent);
}

.trace-row summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 12px;
  cursor: pointer;
  list-style: none;
  white-space: nowrap;
  overflow: hidden;
}

.trace-row summary::-webkit-details-marker { display: none; }

.dir { flex: none; font-weight: 700; }
.dir.to-host { color: var(--to-host); }
.dir.to-widget { color: var(--to-widget); }

.method { overflow: hidden; text-overflow: ellipsis; }

.kind {
  flex: none;
  margin-left: auto;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.trace-row.invalid .method,
.trace-row.invalid .kind,
.trace-row.invalid .dir { color: var(--err); }

.trace-row pre {
  margin: 0;
  padding: 6px 12px 10px 28px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--muted);
  overflow-x: auto;
}

@media (prefers-reduced-motion: no-preference) {
  .trace-row { animation: row-in 160ms ease-out; }
  @keyframes row-in {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: none; }
  }
}
```

- [x] **Step 5: `pnpm install`, tests PASS** → **Step 6: commit** `feat(studio): scaffold Vite+React app with zustand store and scenario mocks`

---

### Task 3: Demo widget

**Files:**
- Create: `apps/studio/src/demo/kpi-widget.html`

**Interfaces:**
- Produces: self-contained HTML widget speaking MCP Apps JSON-RPC: sends `ui/initialize`, applies `hostContext.theme`, listens for `ui/notifications/host-context-changed`, sends `ui/notifications/size-changed`, calls `tools/call get_metrics` on load and on button click, renders loading/error states. Imported via `?raw` into Canvas.

- [x] **Step 1: Write widget** (full HTML in repo; verification is Task 5's live run)

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body {
    margin: 0;
    padding: 24px;
    font-family: system-ui, -apple-system, sans-serif;
    background: #ffffff;
    color: #16181d;
    transition: background 200ms, color 200ms;
  }
  body.dark { background: #1c212b; color: #e8eaf0; }
  .card {
    border: 1px solid rgba(127, 127, 127, 0.35);
    border-radius: 10px;
    padding: 16px 20px;
    max-width: 280px;
  }
  .label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .value {
    font-size: 34px;
    font-weight: 700;
    margin: 6px 0 2px;
    font-variant-numeric: tabular-nums;
  }
  .status { font-size: 13px; opacity: 0.8; min-height: 18px; }
  .status.error { color: #c94f4f; opacity: 1; }
  button {
    margin-top: 14px;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid rgba(127, 127, 127, 0.4);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
</style>
</head>
<body>
<div class="card">
  <div class="label">KPI · get_metrics</div>
  <div class="value" id="value">—</div>
  <div class="status" id="status">connecting…</div>
  <button id="refresh">Refresh</button>
</div>
<script>
  (() => {
    let nextId = 0;
    const pending = new Map();

    function request(method, params) {
      const id = 'w' + ++nextId;
      parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }

    function applyContext(ctx) {
      if (ctx && ctx.theme) document.body.classList.toggle('dark', ctx.theme === 'dark');
    }

    window.addEventListener('message', (ev) => {
      const msg = ev.data;
      if (!msg || msg.jsonrpc !== '2.0') return;
      if (msg.id !== undefined && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(msg.error);
        else p.resolve(msg.result);
      } else if (msg.method === 'ui/notifications/host-context-changed') {
        applyContext(msg.params);
      }
    });

    const $ = (id) => document.getElementById(id);

    async function loadMetrics() {
      $('status').textContent = 'loading…';
      $('status').className = 'status';
      try {
        const r = await request('tools/call', { name: 'get_metrics', arguments: {} });
        $('value').textContent = Number(r.value).toLocaleString();
        $('status').textContent = r.label + ' ' + (r.delta >= 0 ? '▲' : '▼') + Math.abs(r.delta) + '%';
      } catch (e) {
        $('value').textContent = '—';
        $('status').textContent = e.message || 'tool call failed';
        $('status').className = 'status error';
      }
    }

    $('refresh').addEventListener('click', loadMetrics);

    (async () => {
      const init = await request('ui/initialize', {
        protocolVersion: '2026-01-26',
        appCapabilities: {},
      });
      applyContext(init.hostContext);
      parent.postMessage(
        { jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { width: 328, height: 190 } },
        '*',
      );
      loadMetrics();
    })();
  })();
</script>
</body>
</html>
```

- [x] **Step 2: commit** `feat(studio): demo KPI widget speaking MCP Apps JSON-RPC`

---

### Task 4: Canvas + panels + App layout

**Files:**
- Create: `apps/studio/src/components/Canvas.tsx`, `apps/studio/src/components/TracePanel.tsx`, `apps/studio/src/components/HeaderControls.tsx`
- Modify: `apps/studio/src/App.tsx`

**Interfaces:**
- Consumes: `useStudioStore`, `scenarios`, `HostEmulator`, `IframeTransport`, `McpAppsAdapter`, widget HTML via `?raw`.
- Produces: working SPA. No new exported APIs.

- [x] **Step 1: Canvas** (`src/components/Canvas.tsx`)

```tsx
import { useEffect, useRef } from 'react';
import { HostEmulator, IframeTransport, McpAppsAdapter } from '@studio/host-emulator';
import { scenarios, useStudioStore } from '../store.js';
import widgetHtml from '../demo/kpi-widget.html?raw';

export function Canvas() {
  const scenario = useStudioStore((s) => s.scenario);
  const hostContext = useStudioStore((s) => s.hostContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emulatorRef = useRef<HostEmulator | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const transport = new IframeTransport(iframe);
    const emulator = new HostEmulator({
      adapter: new McpAppsAdapter(),
      transport,
      mocks: scenarios[scenario],
      hostContext: useStudioStore.getState().hostContext,
      onLog: (ev) => useStudioStore.getState().appendLog(ev),
    });
    emulator.start();
    emulatorRef.current = emulator;
    return () => {
      emulator.stop();
      transport.dispose();
      emulatorRef.current = null;
    };
  }, [scenario]);

  useEffect(() => {
    const emulator = emulatorRef.current;
    if (emulator && emulator.getHostContext() !== hostContext) {
      emulator.setHostContext(hostContext);
    }
  }, [hostContext]);

  return (
    <main className="canvas">
      <div className="viewport">
        <iframe
          key={scenario}
          ref={iframeRef}
          title="widget under test"
          sandbox="allow-scripts"
          srcDoc={widgetHtml}
        />
      </div>
    </main>
  );
}
```

- [x] **Step 2: TracePanel** (`src/components/TracePanel.tsx`)

```tsx
import type { RpcLogEvent } from '@studio/shared';
import { useStudioStore } from '../store.js';

const DIR_GLYPH = { 'widget→host': '⇢', 'host→widget': '⇠' } as const;

function rowLabel(ev: RpcLogEvent): string {
  if (ev.kind === 'invalid') return ev.error ?? 'invalid message';
  if (ev.kind === 'response') return `#${String(ev.id)}`;
  return ev.method ?? '';
}

export function TracePanel() {
  const log = useStudioStore((s) => s.log);
  const clearLog = useStudioStore((s) => s.clearLog);

  return (
    <aside className="trace">
      <div className="trace-head">
        <span>RPC trace · {log.length}</span>
        <button onClick={clearLog}>Clear</button>
      </div>
      <div className="trace-list">
        {log.length === 0 && <p className="trace-empty">No traffic yet. The widget talks as soon as it loads.</p>}
        {log.map((ev, i) => (
          <details key={i} className={`trace-row${ev.kind === 'invalid' ? ' invalid' : ''}`}>
            <summary>
              <span className={`dir ${ev.direction === 'widget→host' ? 'to-host' : 'to-widget'}`}>
                {DIR_GLYPH[ev.direction]}
              </span>
              <span className="method">{rowLabel(ev)}</span>
              <span className="kind">{ev.kind}</span>
            </summary>
            <pre>{JSON.stringify(ev.payload, null, 2)}</pre>
          </details>
        ))}
      </div>
    </aside>
  );
}
```

- [x] **Step 3: HeaderControls + App**

`src/components/HeaderControls.tsx`:
```tsx
import type { ScenarioId } from '../store.js';
import { useStudioStore } from '../store.js';

export function HeaderControls() {
  const hostContext = useStudioStore((s) => s.hostContext);
  const scenario = useStudioStore((s) => s.scenario);
  const setHostContext = useStudioStore((s) => s.setHostContext);
  const setScenario = useStudioStore((s) => s.setScenario);

  return (
    <div className="controls">
      <label className="control">
        Scenario
        <select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)}>
          <option value="default">default</option>
          <option value="loading">loading</option>
          <option value="error">error</option>
        </select>
      </label>
      <label className="control">
        Theme
        <select value={hostContext.theme} onChange={(e) => setHostContext({ theme: e.target.value as 'light' | 'dark' })}>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </label>
      <label className="control">
        Display
        <select
          value={hostContext.displayMode}
          onChange={(e) => setHostContext({ displayMode: e.target.value as 'inline' | 'fullscreen' | 'pip' })}
        >
          <option value="inline">inline</option>
          <option value="fullscreen">fullscreen</option>
          <option value="pip">pip</option>
        </select>
      </label>
    </div>
  );
}
```

`src/App.tsx`:
```tsx
import { Canvas } from './components/Canvas.js';
import { HeaderControls } from './components/HeaderControls.js';
import { TracePanel } from './components/TracePanel.js';

export function App() {
  return (
    <div className="app">
      <header className="header">
        <span className="brand">
          MCP Apps <em>Studio</em>
        </span>
        <HeaderControls />
      </header>
      <Canvas />
      <TracePanel />
    </div>
  );
}
```

- [x] **Step 4: typecheck + tests + build** — `pnpm typecheck && pnpm test && pnpm -F @studio/app build` → all green.

- [x] **Step 5: commit** `feat(studio): canvas with emulated host, RPC trace panel, context controls`

---

### Task 5: Live smoke verification

- [x] **Step 1:** `pnpm -F @studio/app dev` in background; `curl` the served page, confirm 200 + root div + module script.
- [x] **Step 2:** stop server, report manual check steps to user (scenario switch, theme push, trace inspection).

## Self-Review Notes

- StrictMode double-mounts effects: Canvas effect creates/destroys emulator twice on mount — safe because stop() + dispose() fully tear down; second mount re-wires. Widget iframe itself is not remounted by StrictMode (DOM node persists), but the emulator re-attaches to the same iframe. Initialize handshake may occur once against the second emulator instance — acceptable; log clears on scenario switch.
- `emulator.getHostContext() !== hostContext` guard: reference equality — after emulator creation with the store's context object, the first effect run is a no-op; store updates create new objects, triggering push. HostEmulator.setHostContext stores the merged object, not the store's reference, so consecutive distinct patches still push. Edge: patch to same values pushes redundantly — harmless.
- `?raw` import needs `types: ["vite/client"]` — included in studio tsconfig.
