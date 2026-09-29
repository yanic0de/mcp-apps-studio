import { describeIntent } from '../intents.js';
import { useStudioStore } from '../store.js';

/** What the widget asked the host to do. A fake host shows requests; it never acts on them by itself. */
export function HostRequests() {
  const intents = useStudioStore((s) => s.intents);
  if (intents.length === 0) return null;
  return (
    <section className="host-requests" aria-label="Widget requests">
      <h2>Widget requests · {intents.length}</h2>
      <ul>
        {intents.map(({ seq, intent }) => {
          const d = describeIntent(intent);
          return (
            <li key={seq}>
              <span className="host-requests__kind">{d.kind}</span>
              {d.href ? (
                <a href={d.href} target="_blank" rel="noopener noreferrer">
                  {d.text}
                </a>
              ) : (
                <span>{d.text}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
