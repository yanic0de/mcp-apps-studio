---
"mcp-apps-studio": minor
---

**Interaction steps in stories.** A scenario can now list `steps` that `mcp-apps-studio test` plays after the handshake:

- `click`, `fill` and `press` act inside the widget;
- `expectToolCall { name, arguments? }` and `expectMessage { method, params? }` wait for the widget to send that message, matching `arguments`/`params` as a subset.

The first failing step fails the run, with a reason that names the step and quotes what the widget sent instead. The `Step` type is exported. The component library's `kpi-card` has a `refresh` scenario as an example.
