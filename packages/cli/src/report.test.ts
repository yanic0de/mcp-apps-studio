import { describe, expect, it } from 'vitest';
import { renderHtmlReport, renderMarkdownSummary } from './report.js';
import type { RunResult } from './test-plan.js';

const results: RunResult[] = [
  { widget: 'kpi', scenario: 'default', theme: 'light', ok: true, failures: [], screenshot: 'kpi/default.light.png' },
  {
    widget: 'kpi',
    scenario: 'error',
    theme: 'dark',
    ok: false,
    failures: ['visual change: 42 pixels differ from the baseline', '<script>x</script>'],
    screenshot: 'kpi/error.dark.png',
    baseline: '../snaps/kpi/error.dark.png',
    diff: 'kpi/error.dark.diff.png',
  },
];

describe('renderHtmlReport', () => {
  it('lists every run and shows baseline, actual and diff for visual failures', () => {
    const html = renderHtmlReport(results, []);
    expect(html).toContain('kpi / default');
    expect(html).toContain('1 passed, 1 failed');
    expect(html).toContain('src="../snaps/kpi/error.dark.png"');
    expect(html).toContain('src="kpi/error.dark.png"');
    expect(html).toContain('src="kpi/error.dark.diff.png"');
  });

  it('escapes failure text and lists discovery errors', () => {
    const html = renderHtmlReport(results, [{ file: 'broken.stories.mcp.ts', message: 'bad <kind>' }]);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('bad &lt;kind&gt;');
  });
});

describe('renderMarkdownSummary', () => {
  it('renders a table row per run and the totals', () => {
    const md = renderMarkdownSummary(results, []);
    expect(md).toContain('| ✅ | kpi | default | light |');
    expect(md).toContain(
      '| ❌ | kpi | error | dark | visual change: 42 pixels differ from the baseline; <script>x</script> |'.replace(
        '<script>x</script>',
        '&lt;script&gt;x&lt;/script&gt;',
      ),
    );
    expect(md).toContain('**1 passed, 1 failed**');
  });
});
