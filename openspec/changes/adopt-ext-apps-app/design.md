# Design

## Context

The SDK `App` (`@modelcontextprotocol/ext-apps`, MIT, maintained in the `modelcontextprotocol` GitHub org) is the reference View implementation of SEP-1865. It runs in Node given any MCP `Transport`, which the conformance test already exploits. It offers events via `addEventListener` and `on*` setters, `callServerTool`, the intents, `autoResize`, and document helpers (`applyDocumentTheme` sets `data-theme` + `color-scheme`, `applyHostStyleVariables`, `applyHostFonts`). It does not offer: a lifecycle state that survives subscribing late, a "latest call wins" tool-call hook, or an `isError` → error unwrapping.

## Goals / Non-Goals

**Goals:** zero protocol code in `widget-runtime`; keep the conveniences components rely on; node-testable against the real emulator.

**Non-Goals:** wrapping every `App` method (components call `app.openLink` etc. directly); using the SDK's `useApp` hook (it creates the app inside a component, so lifecycle notifications that arrive before an effect subscribes are lost — the reason for `connectWidget`).

## Decisions

1. **Keep the package, shrink it to extras** rather than deleting it: components still need the lifecycle store and the hooks, and the registry keeps a single, documented dependency. Alternative — components importing only the SDK — would copy those helpers into every component.
2. **Record before connect.** `connectWidget` attaches the lifecycle store and the document applier to the `App` before `connect()`. The host plays `tool-input`/`tool-result` right after `initialized`, i.e. possibly before React mounts.
3. **External store + `useSyncExternalStore`** for the lifecycle: one source of state shared by any number of components.
4. **Tests run against the real `HostEmulator`** through a structural MCP-transport adapter (`toMcpTransport`) exported by `host-emulator` (no SDK import there). Widget-runtime tests become integration tests of both sides of the protocol.
5. **No `@studio/shared` dependency**: types come from the SDK (`CallToolResult` from `@modelcontextprotocol/sdk/types.js`, `McpUiHostContext` from the SDK).

## Risks / Trade-offs

- [Bigger component bundles] → measured; the SDK protocol layer is shared by all widgets that use it and is the cost of spec-exactness.
- [SDK API churn] → conformance test + these integration tests fail on upgrade; pin a caret range.
