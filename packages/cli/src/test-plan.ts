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
  /** Paths relative to the output directory. */
  screenshot?: string;
  baseline?: string;
  diff?: string;
}

/**
 * A file-name-safe path segment: anything outside `[A-Za-z0-9._-]` becomes `_`, and `.`/`..`/empty
 * become `_`, so names from story files can never steer an artifact outside its directory.
 */
export function safeSegment(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_');
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? '_' : cleaned;
}

/** Widget ids may be root-relative paths (colliding basenames): keep them as folders, segment by segment. */
const safeId = (id: string) => id.split('/').map(safeSegment).join('/');

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
          screenshot: `${safeId(w.id)}/${safeSegment(scenario)}.${theme}.png`,
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

/** What the studio canvas renders, from `window.__mcpStudio.getActive()`. */
export interface ActiveTarget {
  widget: string | null;
  scenario: string;
  theme: string;
}

/**
 * The studio falls back to the first widget/scenario on an unknown deep link (friendly for humans),
 * so a run must confirm it rendered what it asked for — otherwise it could pass for another story.
 */
export function checkTarget(
  run: Pick<TestRun, 'widget' | 'scenario' | 'theme'>,
  active: ActiveTarget | undefined,
): string[] {
  const requested = `${run.widget}/${run.scenario} [${run.theme}]`;
  if (!active?.widget) return [`studio rendered no widget (requested ${requested})`];
  if (active.widget === run.widget && active.scenario === run.scenario && active.theme === run.theme) return [];
  return [`studio rendered ${active.widget}/${active.scenario} [${active.theme}] instead of ${requested}`];
}

export function summarize(results: RunResult[]): string {
  const lines = results.flatMap((r) => [
    `  ${r.ok ? '✓' : '✗'} ${r.widget}/${r.scenario} [${r.theme}]`,
    ...r.failures.map((f) => `      ${f}`),
  ]);
  const passed = results.filter((r) => r.ok).length;
  return `${lines.join('\n')}\n\n${passed} passed, ${results.length - passed} failed`;
}
