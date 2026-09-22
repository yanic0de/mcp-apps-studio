import type { RpcLogEvent } from '@studio/shared';
import { useState } from 'react';
import { recordScenario, scenarioSnippet } from '../record.js';
import { useStudioStore } from '../store.js';

const DIR_GLYPH = { 'widget→host': '⇢', 'host→widget': '⇠' } as const;

function rowLabel(ev: RpcLogEvent): string {
  if (ev.kind === 'invalid') return ev.error ?? 'invalid message';
  if (ev.kind === 'response') return `#${String(ev.id)}`;
  return ev.method ?? '';
}

export function TracePanel() {
  const log = useStudioStore((s) => s.log);
  const clearLog = useStudioStore((s) => s.clearLog);
  const isLive = useStudioStore((s) => s.scenario === 'live');
  const [saved, setSaved] = useState<{ name: string; snippet: string } | null>(null);

  // Live traffic → offline scenario: added to the widget, selected, and copied as a story snippet.
  const saveScenario = () => {
    const { log: current, liveToolName, addScenario } = useStudioStore.getState();
    const scenario = recordScenario(current, liveToolName ?? undefined);
    const name = addScenario(scenario);
    const snippet = scenarioSnippet(name, scenario);
    setSaved({ name, snippet });
    void navigator.clipboard?.writeText(snippet).catch(() => {});
  };

  return (
    <aside className="trace">
      <div className="trace-head">
        <span>RPC trace · {log.length}</span>
        <span className="trace-actions">
          {isLive && log.length > 0 && (
            <button type="button" onClick={saveScenario}>
              Save scenario
            </button>
          )}
          <button type="button" onClick={clearLog}>
            Clear
          </button>
        </span>
      </div>
      {saved && (
        <details className="trace-saved" open>
          <summary>
            Saved as <code>{saved.name}</code> · snippet copied
          </summary>
          <pre data-testid="scenario-snippet">{saved.snippet}</pre>
          <button type="button" onClick={() => setSaved(null)}>
            Dismiss
          </button>
        </details>
      )}
      <div className="trace-list">
        {log.length === 0 && <p className="trace-empty">No traffic yet. The widget talks as soon as it loads.</p>}
        {log.map((ev) => (
          <details key={ev.seq} className={`trace-row${ev.kind === 'invalid' ? ' invalid' : ''}`}>
            <summary>
              <span className={`dir ${ev.direction === 'widget→host' ? 'to-host' : 'to-widget'}`}>
                {DIR_GLYPH[ev.direction]}
              </span>
              <span className="method">{rowLabel(ev)}</span>
              <span className="kind">{ev.kind}</span>
            </summary>
            <pre>{JSON.stringify(ev.payload, null, 2)}</pre>
          </details>
        ))}
      </div>
    </aside>
  );
}
