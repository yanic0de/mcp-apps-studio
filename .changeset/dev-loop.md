---
"mcp-apps-studio": minor
---

Dev loop: the studio live-reloads on story/widget changes (SSE), broken stories are reported per file instead of failing the whole manifest (and fail `test`), ids stay unique across folders, and a story `widget` may be a dev-server URL — `mcp-apps-studio/vite` lets Vite serve it into the null-origin sandbox with HMR. A new `ui/initialize` now starts a new view instance that receives the tool call again.
