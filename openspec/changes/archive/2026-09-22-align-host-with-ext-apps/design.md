# Design

## Context

The reference for the wire protocol is `@modelcontextprotocol/ext-apps@1.7.4` (`dist/src/spec.types.d.ts`, `LATEST_PROTOCOL_VERSION = "2026-01-26"`), already installed for the example and test servers. Its `App` class runs in Node when constructed with `autoResize: false` and connected over any object implementing the MCP SDK `Transport` interface (`start`, `send`, `close`, `onmessage`), so the whole View side of the protocol can be driven in vitest without a DOM.

Current divergences are listed in proposal.md. The layering rule stays: `shared` holds schemas and constants, the adapter is a pure translator, `HostEmulator` is the only stateful piece, the studio reacts through callbacks.

## Goals / Non-Goals

**Goals:**
- A widget written against the official `App` handshakes, calls tools and uses every View → Host request without errors or `invalid` trace entries.
- `tools/call` results have the same shape in mock mode, live mode and a real host.
- Drift between the emulator and the SDK is caught by a test.

**Non-Goals:**
- Pushing `tool-input` / `tool-result` to the widget and describing the originating tool call in stories: next change.
- Honoring `_meta.ui.csp`, `permissions`, `prefersBorder`, `visibility`: separate change.
- A studio panel that lists widget intents (messages, links, model context); here they are only reported through a callback and visible in the trace.
- Replacing `WidgetClient` with the official `App`: worth evaluating, but it redefines the `widget-runtime` package and the component contract.
- Sampling (`sampling/createMessage`), app-provided tools, sandbox proxy notifications.

## Decisions

**1. `CallToolResult` as a minimal zod schema in `shared`, not the SDK type.**
`shared` must stay small and runtime-agnostic (it ships inside every widget via `widget-runtime`). The schema checks only what the host relies on: `content` is an array of objects with a string `type` (passthrough for the rest), `structuredContent` is an optional record, `isError` an optional boolean. Precise block shapes are the SDK's job; the conformance test fails if our output stops satisfying the SDK's own schemas. Alternative — depending on `@modelcontextprotocol/sdk` in `shared` — rejected for bundle size and layering.

**2. Mock shapes mirror the result, not the transport.**
- `static`: `{ structuredContent?, content?, delayMs? }` → `{ content: content ?? [text(JSON.stringify(structuredContent))], structuredContent }`. Deriving the text block matches what MCP servers are told to do for backward compatibility and keeps stories short.
- `error`: `{ message, delayMs? }` → `{ isError: true, content: [text(message)] }` — this is what servers return for tool failures and what real hosts forward.
- `rpc-error`: `{ error: { code, message }, delayMs? }` → JSON-RPC error — protocol failures (unknown tool, host refusal) still need to be testable.
- No compatibility shim for `result:`: the project is pre-1.0 and every story in the repo is migrated in the same change.

**3. Live passthrough forwards the server's result unchanged.**
`callTool` from the MCP client already returns a `CallToolResult`; the studio stops unwrapping and stops throwing on `isError`. Transport or protocol failures (the SDK throws) become `RpcError` with the original code when available, else `INTERNAL_ERROR`.

**4. New adapter actions; one intent callback on the emulator.**
The adapter translates each new method into a semantic action with validated params (same `withParams` pattern). `HostEmulator` answers them:
- `initialized` → marks the widget ready (hook for the next change); no response, no trace error.
- `open-link`, `message`, `update-model-context`, `download-file` → `{}` (success), and `onWidgetIntent(action)` lets the embedder show them. A fake host has nothing to open or send; success is what a permissive real host returns.
- `request-display-mode` → if the mode is in `adapter.capabilities().displayModes`, update the context, push `host-context-changed { displayMode }` and answer `{ mode }`; otherwise answer `{ mode: current }` (the spec allows the host to decline).
- `log` (`notifications/message`) and `request-teardown` → accepted notifications, reported through `onWidgetIntent`.
A dedicated callback per intent was rejected: one discriminated callback keeps `HostEmulatorOptions` small and lets the studio switch on `type`.

**5. Studio sync for widget-initiated context changes.**
`HostEmulator` gains `onHostContextChanged(ctx)`, fired only for changes the widget initiated. The studio store copies the object as-is (`replaceHostContext`), so the Canvas effect, which compares by identity, does not push the same change back to the widget.

**6. Initialize result.**
`hostCapabilities`: `openLinks`, `downloadFile`, `serverTools`, `serverResources`, `logging`, `message` and `updateModelContext` (with `text` and `structuredContent` modalities). `hostContext` = current context plus `availableDisplayModes` from the adapter. `defaultHostContext` gains `platform: 'web'` and `userAgent: 'mcp-apps-studio'`; `hostContextSchema` gains the SDK's optional fields (`availableDisplayModes`, `timeZone`, `platform`, `userAgent`, `deviceCapabilities`) and the width/maxWidth × height/maxHeight `containerDimensions` union.

**7. Conformance test location.**
`packages/host-emulator/src/sdk-conformance.test.ts`, with `@modelcontextprotocol/ext-apps` and `@modelcontextprotocol/sdk` as dev dependencies of that package only. An in-memory pair connects the SDK `Transport` (App side) to our `Transport` (host side), asynchronously, like `postMessage`.

## Risks / Trade-offs

- [Breaking story format] → all repo stories, the demo widget and e2e are migrated in this change; the proposal flags it as BREAKING.
- [Minimal `CallToolResult` schema accepts results the SDK would reject] → the conformance test validates through the SDK client, which parses results with the SDK schema.
- [SDK update renames a method] → conformance test fails; fix in `protocol.ts` only.
- [Auto-derived text fallback may be long for big payloads] → acceptable for mocks; authors can set `content` explicitly.
