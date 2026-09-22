import { MCP_APPS_METHODS, type RpcLogEvent, type WidgetManifestEntry } from '@studio/shared';

export type Theme = 'light' | 'dark';

export interface TestRun {
  widget: string;
  scenario: string;
  theme: Theme;
  /** Studio deep link (without the token). */
  query: string;
  /** Relative to the output directory. */
  screenshot: string;
}

export interface RunResult {
  widget: string;
  scenario: string;
  theme: Theme;
  ok: boolean;
  failures: string[];
  screenshot?: string;
}

/** One run per widget × scenario × theme; `live` needs a real server, so it is skipped. */
export function buildTestPlan(manifest: WidgetManifestEntry[], themes: Theme[]): TestRun[] {
  return manifest.flatMap((w) =>
    Object.keys(w.scenarios)
      .filter((s) => s !== 'live')
      .flatMap((scenario) =>
        themes.map((theme) => ({
          widget: w.id,
          scenario,
          theme,
          query: new URLSearchParams({ widget: w.id, scenario, theme }).toString(),
          screenshot: `${w.id}/${scenario}.${theme}.png`,
        })),
      ),
  );
}

/** A run passes when the SDK handshake completed and the trace has no invalid messages. */
export function evaluateRun(log: RpcLogEvent[]): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const init = log.find(
    (e) => e.direction === 'widget→host' && e.kind === 'request' && e.method === MCP_APPS_METHODS.uiInitialize,
  );
  if (!init) failures.push(`widget never sent ${MCP_APPS_METHODS.uiInitialize}`);
  if (!init || !log.some((e) => e.direction === 'host→widget' && e.kind === 'response' && e.id === init.id)) {
    failures.push(`host never answered ${MCP_APPS_METHODS.uiInitialize}`);
  }
  if (!log.some((e) => e.kind === 'notification' && e.method === MCP_APPS_METHODS.initialized)) {
    failures.push(`widget never sent ${MCP_APPS_METHODS.initialized}`);
  }
  for (const e of log) {
    if (e.kind === 'invalid') failures.push(`invalid message: ${e.error ?? JSON.stringify(e.payload)}`);
  }
  return { ok: failures.length === 0, failures };
}

export function summarize(results: RunResult[]): string {
  const lines = results.flatMap((r) => [
    `  ${r.ok ? '✓' : '✗'} ${r.widget}/${r.scenario} [${r.theme}]`,
    ...r.failures.map((f) => `      ${f}`),
  ]);
  const passed = results.filter((r) => r.ok).length;
  return `${lines.join('\n')}\n\n${passed} passed, ${results.length - passed} failed`;
}
