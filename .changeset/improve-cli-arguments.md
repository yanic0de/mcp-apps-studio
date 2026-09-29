---
"mcp-apps-studio": patch
---

Friendlier CLI:

- `--help`/`-h` (also per command) and `--version`/`-v`.
- Strict flags per command: an unknown flag, a missing value or a mistyped command fails with a one-line `error:` and exit code `1` instead of being ignored or printing a stack trace.
- `--port` is validated, and a busy port prints a hint.
- `--token` needs at least 32 characters.
- An install with missing studio assets tells you to reinstall.
