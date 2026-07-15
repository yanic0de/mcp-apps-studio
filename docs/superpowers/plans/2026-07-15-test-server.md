# Test MCP Server + Generic Live Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@studio/test-server` — испытательный полигон для студии: tools `echo` / `slow_metrics` / `fail` / `get_rows` (пагинация) / `counter` (состояние), виджет-инспектор `ui://test/inspector.html` с кнопками на каждый tool, streamable HTTP `:3200`. Studio live-режим становится универсальным: URL сервера из `?server=` (default :3100), виджет ищется через `resources/list` по mime `text/html;profile=mcp-app` вместо захардкоженного URI. E2E: инспектор с тест-сервера гоняет tools через live-passthrough.

**Architecture:** Тот же паттерн, что example-server (транспорт-фри фабрика + express stateless + CORS), но цель другая: не «образцовый» сервер, а исчерпывающий — каждый tool покрывает одно поведение эмулятора. `counter` — модульное состояние (переживает stateless-переcоздание серверов). Mime-константа `MCP_APPS_RESOURCE_MIME` уезжает в shared/protocol.ts (studio перестаёт знать про конкретные URI).

## Global Constraints

- test-server, как и example-server, без workspace-зависимостей — только публичные SDK (+zod, express).
- Инспектор — vanilla JS (тест-фикстура, контракт widget-runtime — для библиотечных компонентов).
- Порт 3200 (`PORT` override). Все прежние тесты/поведения не ломаются: default live URL остаётся :3100.

---

### Task 1: shared — mime константа

`protocol.ts`: `export const MCP_APPS_RESOURCE_MIME = 'text/html;profile=mcp-app'`. Typecheck. Commit c Task 2.

### Task 2: @studio/test-server

**Files:** `packages/test-server/{package.json,tsconfig.json}`, `src/{server.ts,inspector.html,main.ts,index.ts}`; test `src/server.test.ts`.

**Interfaces:** `createTestServer(): McpServer`; `INSPECTOR_RESOURCE_URI = 'ui://test/inspector.html'`; `TOTAL_ROWS = 42`.

Tools (все с `_meta.ui.resourceUri` на инспектор, все со structuredContent + text-fallback):
- `echo { message?: string }` → `{ echoed: { message } }` — round-trip/трасса;
- `slow_metrics { delayMs?: 0..10000 = 1500 }` → метрики после задержки — loading-состояния против реального сервера;
- `fail { message? = 'Intentional failure' }` → `isError: true` — путь ошибки через passthrough;
- `get_rows { page? = 1, pageSize? = 1..100 = 10 }` → `{ columns, rows, total: 42, page }` — детерминированные строки `Row N`;
- `counter { by? = 1 }` → `{ count }` — модульное состояние сервера.

**Test sketch (InMemoryTransport + Client):** 5 tools в списке с `_meta.ui`; echo возвращает аргументы; fail → `isError` + текст; get_rows page=2/pageSize=5 → строки 6–10, total 42; counter дважды → 1, 2 (сброс модуля между тестами не нужен — счётчик монотонный, проверять дельту); ресурс — mime `text/html;profile=mcp-app`, html содержит `ui/initialize`.

`main.ts` — копия паттерна example-server, порт 3200. Smoke: `/health`, initialize по curl.

**Commit:** `feat(test-server): MCP test polygon — echo/slow/fail/rows/counter tools and protocol inspector widget`

### Task 3: studio — generic live mode

**Files:** modify `apps/studio/src/mcp-client.ts`, `components/Canvas.tsx` (текст ошибки).

- `liveServerUrl(): string` — `?server=` из `location.search`, иначе `http://localhost:3100/mcp` (вызов внутри функции, модуль остаётся импортируемым в node).
- `connectMcpServer(url = liveServerUrl())`: `listResources()` → первый ресурс с mime `MCP_APPS_RESOURCE_MIME` (fallback: `uri.startsWith('ui://')`) → `readResource`. Нет ресурсов → понятная ошибка. Экспорт `connectExampleServer` удалить (Canvas — единственный потребитель).
- Canvas: `connectMcpServer()`; подсказка в ошибке упоминает `?server=`.

**Verify:** `pnpm test && pnpm typecheck && pnpm -F @studio/app build`; e2e live-спека (example-server) обязана остаться зелёной без правок — обратная совместимость.

**Commit:** `feat(studio): live mode connects to any MCP server via ?server= and resources/list discovery`

### Task 4: e2e — инспектор через live

**Files:** `e2e/playwright.config.ts` (webServer #4: `pnpm -F @studio/test-server dev`, url `/health` :3200), `e2e/tests/test-server.spec.ts`.

Spec: `goto '/?server=http://127.0.0.1:3200/mcp'` → Scenario→live → в iframe инспектор; кнопка echo → output содержит `echoed`; кнопка fail → `Intentional failure`; кнопка rows → `Row 1`; в трассе страницы есть `tools/call`.

**Verify:** `pnpm e2e` — все (8 старых + новые) зелёные.
**Commit:** `test(e2e): protocol inspector drives the test server through live passthrough`

### Task 5: docs + memory

CLAUDE.md: команда test-server, `?server=` в live, слой в архитектуре. Память. Commit `docs: test server and generic live mode`.

## Self-Review Notes

- Инспектор шлёт запросы по клику → у каждого свой JSON-RPC id; ответы матчатся по id — параллельные клики не путаются.
- `counter` глобален для процесса → e2e-прогоны недетерминированы по значению; тесты проверяют дельту/наличие поля, не абсолют.
- `listResources` есть в SDK v1 Client (resources/list) — используется и example-server'ом (capability включён регистрацией ресурса).
