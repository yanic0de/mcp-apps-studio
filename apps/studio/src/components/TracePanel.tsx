import type { RpcLogEvent } from '@studio/shared';
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

  return (
    <aside className="trace">
      <div className="trace-head">
        <span>RPC trace · {log.length}</span>
        <button type="button" onClick={clearLog}>
          Clear
        </button>
      </div>
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
