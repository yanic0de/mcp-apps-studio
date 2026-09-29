import type { DiscoveryError } from '@studio/shared';
import type { RunResult } from './test-plan.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const totals = (results: RunResult[], errors: DiscoveryError[]) => {
  const passed = results.filter((r) => r.ok).length;
  return `${passed} passed, ${results.length - passed} failed${errors.length ? `, ${errors.length} stories failed to load` : ''}`;
};

const figure = (label: string, src: string | undefined) =>
  src ? `<figure><img src="${esc(src)}" alt="${label}"><figcaption>${label}</figcaption></figure>` : '';

/** Self-contained HTML (relative image paths) so the CI artifact renders offline. */
export function renderHtmlReport(results: RunResult[], errors: DiscoveryError[]): string {
  const rows = results
    .map((r) => {
      const images = r.diff
        ? `<div class="images">${figure('baseline', r.baseline)}${figure('actual', r.screenshot)}${figure('diff', r.diff)}</div>`
        : r.ok
          ? ''
          : `<div class="images">${figure('actual', r.screenshot)}</div>`;
      const reasons = r.failures.length ? `<ul>${r.failures.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
      return `<section class="${r.ok ? 'ok' : 'fail'}"><h2>${r.ok ? '✓' : '✗'} ${esc(r.widget)} / ${esc(r.scenario)} <small>${esc(r.theme)}</small></h2>${reasons}${images}</section>`;
    })
    .join('\n');
  const errorList = errors.length
    ? `<section class="fail"><h2>Stories that failed to load</h2><ul>${errors
        .map((e) => `<li><code>${esc(e.file)}</code> ${esc(e.message)}</li>`)
        .join('')}</ul></section>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>MCP Apps Studio — story test report</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 24px; color: #1b1f24; background: #fafafa; }
  section { background: #fff; border: 1px solid #ddd; border-left: 4px solid #2da44e; border-radius: 6px; padding: 8px 16px; margin: 12px 0; }
  section.fail { border-left-color: #cf222e; }
  h2 { font-size: 15px; margin: 6px 0; } small { color: #666; font-weight: normal; }
  .images { display: flex; gap: 12px; flex-wrap: wrap; } figure { margin: 0; }
  img { max-width: 420px; border: 1px solid #ddd; } figcaption { font-size: 12px; color: #666; }
</style></head><body>
<h1>Story test report</h1><p><strong>${totals(results, errors)}</strong></p>
${errorList}
${rows}
</body></html>
`;
}

/** Markdown table for $GITHUB_STEP_SUMMARY. */
export function renderMarkdownSummary(results: RunResult[], errors: DiscoveryError[]): string {
  const cell = (s: string) => esc(s).replace(/\|/g, '\\|');
  const lines = [
    '### MCP Apps Studio — story tests',
    '',
    `**${totals(results, errors)}**`,
    '',
    '| | Widget | Scenario | Theme | Failures |',
    '|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.ok ? '✅' : '❌'} | ${cell(r.widget)} | ${cell(r.scenario)} | ${r.theme} | ${cell(r.failures.join('; '))} |`,
    ),
    ...errors.map((e) => `| ❌ | ${cell(e.file)} | — | — | ${cell(e.message)} |`),
    '',
  ];
  return lines.join('\n');
}
