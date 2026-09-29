---
"mcp-apps-studio": patch
---

Hardening before the first release:

- `test` no longer aborts on the first crashing run. The crash becomes a failed result and the reports are always written.
- `--update-snapshots` writes baselines only for passing runs.
- A run fails when the studio rendered a different widget, scenario or theme than the one requested.
- The host emulator no longer sends `host-context-changed` before the handshake or after it stops.
- `ui/open-link` accepts only `http(s)` and `mailto` URLs.
- `add` keeps existing files unless `--force` is given, and reports an unknown component without a stack trace.
- The GitHub Action passes its inputs to shell steps through environment variables and validates `version`. Its actions are pinned by commit SHA.
