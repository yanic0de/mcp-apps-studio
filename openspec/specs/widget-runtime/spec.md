# Widget Runtime

## Purpose

`@studio/widget-runtime` is the only sanctioned channel between a widget and the host. `WidgetClient` performs the handshake, calls tools and tracks host context; `applyHostContextToDocument` carries theme and CSS variables into the document; React hooks under the `./react` subpath wrap the client for components. The main entry stays React-free for vanilla widgets.

## Requirements

### Requirement: Handshake
`connectWidget({ appInfo, capabilities?, transport?, autoResize? })` SHALL create an `App` from `@modelcontextprotocol/ext-apps` with `appInfo` and `capabilities` (default `{}`), attach the tool lifecycle store and the document applier, then connect it (default transport: the SDK's `postMessage` transport to `window.parent`; `autoResize` default `true`) and resolve with `{ app, lifecycle }`. The package MUST NOT implement JSON-RPC framing, request correlation or protocol method names itself.

#### Scenario: Successful initialization
- **WHEN** `connectWidget` connects to a host emulator with theme `dark`
- **THEN** `app.getHostContext().theme === 'dark'`
- **AND** the host reports the widget ready (it received `ui/notifications/initialized`)

### Requirement: Host context
`useHostContext()` SHALL return the app's current host context and re-render when the host sends `host-context-changed`, reflecting the merged context.

#### Scenario: Theme change
- **WHEN** the host changes the theme to `light` after connect
- **THEN** `app.getHostContext()` contains `theme: 'light'` and the previous `locale`

### Requirement: Testability in Node
Everything except the DOM applier SHALL run in Node with an injected MCP transport; the default `window.parent` transport SHALL only be used when no transport is given.

#### Scenario: Import in Node
- **WHEN** the module is imported in Node without `window`
- **THEN** the import does not fail

#### Scenario: Against the emulator in Node
- **WHEN** `connectWidget` is called in Node with a transport bound to a `HostEmulator`
- **THEN** it connects without touching `window` or `document` (with the document applier disabled)

### Requirement: Applying context to the document
When enabled (default), `connectWidget` SHALL apply the host context to the document on connect and on every change using the SDK helpers: `applyDocumentTheme(theme)` (sets `data-theme` and `color-scheme`), `applyHostStyleVariables(styles.variables)` and `applyHostFonts(styles.css.fonts)`.

#### Scenario: Theme and variables
- **WHEN** the host context is `{ theme: 'dark', styles: { variables: { '--color-background-primary': '#111' } } }`
- **THEN** the document root has `data-theme="dark"` and `--color-background-primary` equals `#111`

#### Scenario: Empty patch
- **WHEN** a context change carries no theme and no styles
- **THEN** nothing changes and no exception is thrown

#### Scenario: Dark theme in a built component
- **WHEN** the studio switches a library component to `dark`
- **THEN** the component document root has `data-theme="dark"`

### Requirement: React wrappers
The `./react` subpath SHALL provide `WidgetProvider` (takes the `connectWidget` session), `useWidgetApp` (throws outside the provider), `useHostContext`, `useToolCall(name)` with `data`, `error`, `loading`, `call` — calling `app.callServerTool`, exposing `structuredContent` as `data`, the text of an `isError` result or a rejection message as `error` — and `useToolLifecycle()`. The main entry `.` MUST NOT import React.

#### Scenario: Hook outside the provider
- **WHEN** `useWidgetApp()` is called without a `WidgetProvider`
- **THEN** an error mentioning `<WidgetProvider>` is thrown

#### Scenario: Tool error result
- **WHEN** the tool answers `{ isError: true, content: [{ type: 'text', text: 'db down' }] }`
- **THEN** the state holds `error: 'db down'` and `loading: false`

### Requirement: Latest call wins
`useToolCall` (via `createToolCaller`) SHALL guarantee that with overlapping calls, the settlement of an earlier call never overwrites the state of a later one.

#### Scenario: Slow first, fast second
- **WHEN** the first `call()` is still pending and the second completed with data B
- **THEN** the state holds `data: B, loading: false`
- **AND** the first call's completion does not change the state

### Requirement: Tool lifecycle subscriptions
`createToolLifecycleStore(app)` SHALL subscribe to the app's `toolinputpartial`, `toolinput`, `toolresult` and `toolcancelled` events at creation and expose `getSnapshot()` / `subscribe(cb)` over `reduceToolLifecycle` (`status: 'waiting' | 'streaming' | 'input' | 'result' | 'error' | 'cancelled'`, `input`, `data`, `error`, `reason`). `connectWidget` SHALL create it before connecting, so notifications sent right after the handshake are reflected. `useToolLifecycle()` SHALL read the session's store.

#### Scenario: Result after input
- **WHEN** the host plays `tool-input` with `{ q: 1 }` and `tool-result` with `structuredContent: { v: 1 }` immediately after `initialized`
- **THEN** the store snapshot is `{ status: 'result', input: { q: 1 }, data: { v: 1 } }`

#### Scenario: Unsubscribe
- **WHEN** a subscriber unsubscribes and another event arrives
- **THEN** the subscriber is not called
