# Design

## Context

`align-host-with-ext-apps` made the emulator track readiness (`isReady()` after `initialized`) and added the lifecycle method names to `MCP_APPS_METHODS`. The SDK's `AppBridge` documents the host side: `sendToolInput` exactly once after `initialized` and before `sendToolResult`; `tool-cancelled` MUST be sent if the call was cancelled for any reason.

## Goals / Non-Goals

**Goals:**
- A widget that renders from `ontoolresult` works in mock and live scenarios.
- Stories express loading (delayed result), failure (`isError` result), cancellation and argument streaming.

**Non-Goals:**
- Changing the library components to render from `tool-result` (they keep calling tools on mount; a separate change should decide the component contract).
- Re-running the call after the widget exists (no "re-invoke" button yet).
- `ui/resource-teardown` on unmount.

## Decisions

**1. `toolCall` lives on the scenario, schema in `shared`.**
A scenario is "the situation the widget is in"; the originating call is part of it. `scenarioSchema` moves to `shared` so the CLI story schema, the manifest type and the studio use one definition. `result` reuses the mock kinds (`static`, `error`, `passthrough`) plus `cancelled`; `rpc-error` is excluded because the lifecycle has no JSON-RPC error channel — cancellation is the host's way to report failure.

**2. The emulator resolves the result with a one-entry `MockRouter`.**
`new MockRouter({ [name]: result }, passthrough).call(name, input)` gives the same `CallToolResult` shaping, delay and passthrough handling as `tools/call`, with no second implementation. A thrown error (passthrough failure) becomes `tool-cancelled { reason: message }`.

**3. Sequencing is driven by `initialized`, not by `ui/initialize`.**
Sending before `initialized` would race the widget's handlers. Partials go out synchronously in order, then `tool-input`, then the (possibly delayed) result. If the emulator is stopped while the result is pending, nothing is sent.

**4. `toolInfo`.**
When a scenario has a `toolCall`, the initialize result's `hostContext.toolInfo` is `{ tool: { name, inputSchema } }` — the live tool definition when known, else `{ type: 'object' }` — so widgets that read `toolInfo` behave as in a real host.

**5. Live mode.**
`connectMcpServer` also lists tools and returns the first tool whose `_meta.ui.resourceUri` equals the widget's resource (`linkedTool`). Canvas builds the call from `scenario.toolCall` with `name` defaulting to `linkedTool.name`, `input` to `{}`, `result` to `passthrough`. This simulates "the model called the tool that renders this widget".

## Risks / Trade-offs

- [Widgets that both self-call and render tool-result call the tool twice] → matches real hosts; the KPI reference widget no longer self-calls on load.
- [Linked tool with required arguments fails with `{}` input] → surfaces as `tool-cancelled` with the server's message; the scenario can set `input`.
