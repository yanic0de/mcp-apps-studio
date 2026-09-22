---
"mcp-apps-studio": minor
---

Visual regression for stories: `test --update-snapshots` writes baselines to `mcp-studio-snapshots/`, later runs diff against them (`--threshold`, `--max-diff-pixels`) and fail with a diff image; `report.html` shows baseline/actual/diff; a Markdown summary goes to `$GITHUB_STEP_SUMMARY`. New `install-browser` command installs the Chromium build matching the bundled Playwright. A composite GitHub Action (`action.yml`) runs it all in CI.
