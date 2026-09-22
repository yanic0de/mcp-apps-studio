# Proposal

## Why

`@studio/widget-runtime` re-implements the View side of SEP-1865 (`WidgetClient`: handshake, request correlation, timeouts, notifications) that the official `@modelcontextprotocol/ext-apps` SDK already ships as `App`. Two implementations of one protocol drift: `align-host-with-ext-apps` had to fix `WidgetClient` for `appInfo`, `initialized` and `CallToolResult` after the fact, and it still lacks `openLink`, `sendMessage`, `requestDisplayMode`, `updateModelContext`, auto-resize, host fonts. Widgets built on our client are also tied to this project, while widgets built on `App` run in any MCP Apps host. The studio's job is to host widgets faithfully, not to own a second client SDK.

## What Changes

- **BREAKING** `WidgetClient`, `applyHostContextToDocument`, the `RpcError` re-export and the `WidgetWindow` duck type are removed. The protocol on the widget side is the SDK `App`.
- `widget-runtime` becomes a thin layer of studio conveniences on top of `App`:
  - `connectWidget({ appInfo, capabilities?, transport?, autoResize? })` — creates the `App`, starts recording the tool lifecycle **before** connecting (so an early `tool-result` is never lost), applies the host theme, style variables and fonts to the document on connect and on every change (SDK helpers), connects, returns `{ app, lifecycle }`.
  - `createToolLifecycleStore(app)` — external store over `reduceToolLifecycle`.
  - kept pure helpers: `toolResultData`, `reduceToolLifecycle`, `createToolCaller`.
  - React (`./react`): `WidgetProvider session`, `useWidgetApp`, `useHostContext`, `useToolCall` (via `app.callServerTool`, latest call wins), `useToolLifecycle` (via the store).
- The package depends on the SDK instead of `@studio/shared`, so it can be published and used outside the studio.
- Library components use `connectWidget`; size reporting comes from the SDK's auto-resize instead of hard-coded sizes.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `widget-runtime`: rebuilt on the SDK `App`; removed client requirements now covered by the SDK.
- `component-library`: entry point uses `connectWidget`; auto-resize.

## Impact

- Code: `packages/widget-runtime` (rewrite), `packages/components` (entries, tests, registry text), `packages/host-emulator` (a structural MCP-transport adapter reused by tests), docs.
- Dependencies: `widget-runtime` → `@modelcontextprotocol/ext-apps`, `@modelcontextprotocol/sdk`, `zod`; drops `@studio/shared`. Component bundles grow by the SDK's protocol layer (measured in tasks).
- Users of `WidgetClient` migrate to `connectWidget` / `App` (pre-1.0, no shim).
