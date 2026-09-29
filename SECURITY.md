# Security Policy

## Reporting a vulnerability

Please **do not open a public issue.** Report it privately through GitHub: **Security → Report a vulnerability** on [this repository](https://github.com/yanic0de/mcp-apps-studio/security/advisories/new).

Include what you found, how to reproduce it, and the impact you expect. You will get an answer within 7 days. Fixes are released as soon as they are ready, and you will be credited unless you prefer not to be.

## Supported versions

MCP Apps Studio is pre-1.0. Only the latest published `0.x` minor gets security fixes.

## Threat model

MCP Apps Studio is a **local development tool** that runs code you didn't necessarily write.

| Asset | Threat | Protection |
|---|---|---|
| The studio page and its API | A widget under test reaches the studio's origin or API | Widgets run in an iframe sandboxed with `allow-scripts` only (never `allow-same-origin`), so they have a `null` origin and no cookies. Messages are accepted only from that iframe and are validated before dispatch. |
| The local server | Other websites or LAN hosts reach it | It binds to `127.0.0.1` only. A one-time 128-bit token is required on every request and compared in constant time. The cookie is `HttpOnly` and `SameSite=Strict`. Static serving is traversal-safe. |
| The user's CI | Crafted Action inputs | Inputs reach shell steps only through environment variables, and `version` is validated. Third-party actions are pinned by commit SHA. |

**Out of scope, by design:**

- **Stories are code.** `mcp-apps-studio`, `test` and the GitHub Action execute your `*.stories.mcp.ts` files. Running them on untrusted pull requests with secrets available is equivalent to running untrusted code.
- **The Vite plugin (`mcp-apps-studio/vite`)** adds the `null` origin to your dev server's CORS allowlist, so hot module replacement works inside the sandbox. While the dev server runs, any sandboxed page open in your browser can read it. This is a documented development trade-off: keep secrets out of `VITE_*`.
- **The reference servers** (`example-server`, `test-server`) are development fixtures. They bind to `127.0.0.1` by default.
