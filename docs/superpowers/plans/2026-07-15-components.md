# Widget Runtime + Component Library + Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@studio/widget-runtime` — the only sanctioned way for widgets to talk to the host (typed `WidgetClient` over postMessage, React hooks `useToolCall`/`useHostContext`, `applyHostContextToDocument`). `@studio/components` — KPI Card + DataTable meeting the component contract (CSS-variable theming, text-only fallback, story file with default/loading/error/empty). Static shadcn-style `registry.json` + `mcp-apps-studio add <name>` copying sources into a user project.

**Architecture:** `WidgetClient` mirrors the host bridge from the widget side: duck-typed `WidgetWindow` (node-testable with fakes), validates incoming messages with `parseJsonRpcMessage`, correlates ids, merges `host-context-changed` patches. React layer is a thin context + hooks over the client (no jsdom in tests — hooks verified via typecheck and `react-dom/server` SSR renders of the components). Components ship as source (shadcn model); for studio preview each widget gets a vite+singlefile build into `dist/<name>.html`, referenced by its story file — so the CLI discovers the library itself as a demo project. `add` reads `registry.json` from the resolved `@studio/components` package and copies files.

**Tech Stack:** react 19, react-dom (SSR tests + entries), vite + vite-plugin-singlefile (widget bundles).

## Global Constraints

- Components NEVER touch `window.parent` directly — only via `@studio/widget-runtime` (component contract, architecture doc §5).
- Theming only via CSS custom properties (`--widget-*` with light fallbacks; dark via `[data-theme='dark']` set by `applyHostContextToDocument` from `hostContext.theme` + `styles.variables`).
- Every component exports a text-only fallback function (spec requirement).
- Tests stay node-only: fakes for `WidgetWindow`, `react-dom/server` for markup, no jsdom.
- Runtime package split entry: `.` (vanilla, no react import) vs `./react` — vanilla widgets must not pull react.

---

### Task 1: @studio/widget-runtime

**Files:** `packages/widget-runtime/{package.json,tsconfig.json}`, `src/{index.ts,client.ts,dom.ts,react.tsx}`; tests `src/client.test.ts`, `src/dom.test.ts`.

**Interfaces:**
```ts
// client.ts
export interface WidgetWindow {
  addEventListener(type: 'message', l: (ev: MessageEvent) => void): void;
  removeEventListener(type: 'message', l: (ev: MessageEvent) => void): void;
  parent: { postMessage(message: unknown, targetOrigin: string): void };
}
export class ToolCallError extends Error { code: number }
export class WidgetClient {
  constructor(win?: WidgetWindow);           // default: real window
  connect(): Promise<HostContext>;           // ui/initialize handshake
  callTool<T = unknown>(name: string, args?: unknown): Promise<T>;
  getHostContext(): HostContext | null;
  onHostContextChanged(cb: (patch: Partial<HostContext>) => void): () => void;
  sendSizeChanged(size: { width?: number; height?: number }): void;
  dispose(): void;                           // rejects pending, unsubscribes
}
// dom.ts
export interface ThemableDocument { documentElement: { dataset: Record<string, string>; style: { setProperty(k: string, v: string): void } } }
export function applyHostContextToDocument(ctx: Partial<HostContext>, doc?: ThemableDocument): void; // sets data-theme + styles.variables as CSS props
// react.tsx
export function WidgetProvider(props: { client: WidgetClient; children: ReactNode }): JSX.Element;
export function useWidgetClient(): WidgetClient;
export function useHostContext(): HostContext | null;
export function useToolCall<T>(name: string): { data: T | null; error: string | null; loading: boolean; call: (args?: unknown) => Promise<void> };
```
Incoming messages go through `parseJsonRpcMessage`; responses resolve/reject pending (`error` → `ToolCallError`); `ui/notifications/host-context-changed` merges patch + notifies listeners. Ids `w1, w2, …`.

**Tests (fake window pair):** connect resolves hostContext from fake host reply; callTool success + error→ToolCallError; context patch merge + listener + unsubscribe; sendSizeChanged posts wire notification; dispose rejects pending; garbage messages ignored. dom: sets `data-theme`, sets `--var` props, partial ctx tolerated.

**Commit:** `feat(widget-runtime): typed widget client, host-context DOM helper and React hooks`

### Task 2: @studio/components — KpiCard + DataTable

**Files:** `packages/components/{package.json,tsconfig.json}`, `src/index.ts`, `src/kpi-card/{KpiCard.tsx,kpi-card.css,fallback.ts}`, `src/data-table/{DataTable.tsx,data-table.css,fallback.ts}`; tests `src/kpi-card/kpi-card.test.tsx`, `src/data-table/data-table.test.tsx`.

- `KpiCard({ tool = 'get_metrics', title = 'KPI' })`: `useToolCall<KpiMetrics>`, auto-call on mount, refresh button, states —/loading/error. `KpiMetrics = { value, delta, label }`; `kpiCardTextFallback(m)`.
- `DataTable({ tool = 'get_rows', caption? })`: `TableData = { columns: {key,label}[], rows: Record<string, unknown>[] }`; placeholder до данных, empty-state «No rows», таблица; `dataTableTextFallback(d, maxRows = 5)` — заголовки + строки текстом.
- CSS: только `--widget-*` переменные с светлыми fallback; dark через `[data-theme='dark']`.

**Tests:** SSR `renderToString` внутри `WidgetProvider` с `WidgetClient(fakeWin)` — начальная разметка (title, placeholder); fallback-функции (формат, знак дельты, maxRows-обрезка).

**Commit:** `feat(components): KpiCard and DataTable with runtime hooks, CSS-token theming and text fallbacks`

### Task 3: widget builds + stories

**Files:** `packages/components/build.mjs`, `src/kpi-card/{index.html,main.tsx}`, `src/data-table/{index.html,main.tsx}`, `src/kpi-card/kpi-card.stories.mcp.ts`, `src/data-table/data-table.stories.mcp.ts`.

- `build.mjs`: цикл по виджетам → `vite build` (configFile:false, root=src/<w>, plugins react+singlefile, outDir dist/<w>) → копия `dist/<w>/index.html` → `dist/<w>.html`.
- `main.tsx`: `WidgetClient` → `connect()` → `applyHostContextToDocument` + подписка → render в `#root` → `sendSizeChanged`.
- Stories: `widget: '../../dist/<w>.html'`; kpi: default/loading/error; table: default/empty/error.
- **Smoke:** `pnpm -F @studio/components build` → dist html существуют, самодостаточны (нет `src=`/`href=` на внешние ассеты); `discoverStories('packages/components')` из vitest-теста? — нет, smoke через CLI: `pnpm -F mcp-apps-studio start packages/components` → manifest c 2 виджетами → curl.

**Commit:** `feat(components): self-contained widget builds and story files for studio preview`

### Task 4: registry.json + `add` command

**Files:** `packages/components/registry.json`; cli: `src/add.ts`, modify `src/bin.ts`, `src/index.ts`; test `packages/cli/src/add.test.ts`; cli dep `@studio/components workspace:*`.

- `registry.json`: `{ items: [{ name, title, description, files: [...], dependencies: ['@studio/widget-runtime'] }] }` — kpi-card (KpiCard.tsx, kpi-card.css, fallback.ts), data-table (аналогично).
- `addComponent(name, targetDir): Promise<string[]>` — резолв `@studio/components/package.json`, чтение registry, копия файлов в `targetDir/<name>/`, unknown name → ошибка со списком доступных.
- bin: `mcp-apps-studio add <name> [--dir <dir>]` (default `src/components`), печать скопированного + подсказка про зависимость.
- **Tests:** копирует файлы kpi-card в tmp dir; unknown → throws с перечнем.

**Commit:** `feat(cli): add command installing registry components into a user project`

### Task 5: docs + memory

CLAUDE.md: слои widget-runtime/components, команда build/add, контракт компонентов. Память: фаза 5 готова. Commit `docs: document widget runtime, component library and registry`.

## Self-Review Notes

- `./react` subpath: у widget-runtime появляется exports-карта — main `.` без react-импорта, чтобы vanilla-виджеты не тянули react.
- SSR-тесты не исполняют useEffect — проверяют только начальную разметку; полная логика хуков покрыта косвенно: client покрыт юнитами, built-виджеты гоняются в студии.
- Stories ссылаются на dist — discovery упадёт без build; в CLAUDE.md фиксируется порядок `build → start`.
- `top-level await` в main.tsx допустим (vite target es2022+).
