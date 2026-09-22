# @mcp-apps-studio/widget-runtime

Studio conveniences on top of the official MCP Apps SDK ([`@modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps)). No protocol code of its own: the widget side is the SDK's `App`.

```bash
npm i @mcp-apps-studio/widget-runtime @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk zod
```

```ts
import { connectWidget, toolResultData } from '@mcp-apps-studio/widget-runtime';

// Creates the SDK App, records the tool call that rendered the widget BEFORE the handshake
// (hosts push tool-result right after it), applies the host theme / variables / fonts, auto-resizes.
const { app, lifecycle } = await connectWidget({ appInfo: { name: 'my-widget', version: '1.0.0' } });

lifecycle.subscribe(() => console.log(lifecycle.getSnapshot())); // waiting → input → result | error | cancelled
const metrics = toolResultData(await app.callServerTool({ name: 'get_metrics', arguments: {} }));
```

React (`react` is an optional peer):

```tsx
import { WidgetProvider, useToolCall, useToolLifecycle, useWidgetApp } from '@mcp-apps-studio/widget-runtime/react';
```

Develop and test widgets with [MCP Apps Studio](https://github.com/yanic0de/mcp-app-proba) — Storybook + Playwright for MCP Apps widgets.
