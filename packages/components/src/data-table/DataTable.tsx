import { useToolCall } from '@studio/widget-runtime/react';
import { useEffect } from 'react';
import type { TableData } from './fallback.js';

export interface DataTableProps {
  /** Tool that returns TableData as structuredContent. */
  tool?: string;
  caption?: string;
}

export function DataTable({ tool = 'get_rows', caption }: DataTableProps) {
  const { data, error, loading, call } = useToolCall<TableData>(tool);

  useEffect(() => {
    void call();
  }, [call]);

  if (error) {
    return <p className="data-table__message data-table__message--error">{error}</p>;
  }
  if (!data) {
    return (
      <p className="data-table__message">{loading ? 'loading…' : caption ? `${caption}: loading…` : 'loading…'}</p>
    );
  }
  if (data.rows.length === 0) {
    return <p className="data-table__message">No rows.</p>;
  }

  return (
    <table className="data-table">
      {caption && <caption className="data-table__caption">{caption}</caption>}
      <thead>
        <tr>
          {data.columns.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows carry no id and the whole list is replaced per response
          <tr key={i}>
            {data.columns.map((c) => (
              <td key={c.key}>{String(row[c.key] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
