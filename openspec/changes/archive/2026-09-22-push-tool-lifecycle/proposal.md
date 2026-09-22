# Proposal

## Why

In a real host a widget is born from a tool call the model made: the host renders the tool's `ui://` resource and, after `ui/notifications/initialized`, sends `ui/notifications/tool-input` (the arguments, exactly once) and then `ui/notifications/tool-result` (or `tool-cancelled`). The studio never sends any of these, so widgets that render from the tool result — the pattern the SDK documents and the one Claude uses — show nothing in the studio, and stories cannot describe "which call rendered this widget". The next biggest fidelity gap after `align-host-with-ext-apps`.

## What Changes

- Scenarios gain an optional `toolCall`: `name`, `input` (arguments), `partialInputs` (streamed argument snapshots), and `result` — a mock (`static`, `error`, `passthrough`) or `cancelled` (with `reason`), each with optional `delayMs`.
- After `initialized` the emulator sends, in order: every `tool-input-partial`, one `tool-input`, then `tool-result` (resolved like a mock, `passthrough` goes to the real server) or `tool-cancelled`. A failing passthrough becomes `tool-cancelled` with the error as reason. The host context carries `toolInfo` for the call.
- Live mode discovers the tool linked to the widget (`_meta.ui.resourceUri`) and plays the model's call through the real server unless the scenario overrides it.
- Widget runtime: `onToolInput`, `onToolInputPartial`, `onToolResult`, `onToolCancelled` on `WidgetClient`; `useToolLifecycle()` in `./react`.
- Reference widgets: the example KPI card renders from `tool-result` (Refresh still calls the tool); the inspector prints every lifecycle notification.
- Demo and library stories declare their originating tool call.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `tool-mocks`: scenario `toolCall` schema.
- `host-adapter`: tool lifecycle host events → wire notifications.
- `host-emulator`: lifecycle push after `initialized`; `toolInfo` in context.
- `widget-runtime`: lifecycle subscriptions and hook.
- `studio-app`: scenarios pass `toolCall`; live mode simulates the model's call to the linked tool.
- `cli`: manifest carries `toolCall`.
- `example-server`: KPI card renders from `tool-result`.
- `test-server`: inspector prints lifecycle notifications.

## Impact

- Code: `packages/shared` (scenario schema), `host-emulator`, `widget-runtime`, `apps/studio` (Canvas, mcp-client, demo), `packages/cli` (define/discover), reference widgets, stories, e2e.
- No breaking change: `toolCall` is optional; a scenario without it behaves as before (no lifecycle notifications).
