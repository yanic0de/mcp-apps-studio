import { useToolCall } from '@studio/widget-runtime/react';
import { useEffect } from 'react';
import type { KpiMetrics } from './fallback.js';

export interface KpiCardProps {
  /** Tool that returns KpiMetrics as structuredContent. */
  tool?: string;
  title?: string;
}

export function KpiCard({ tool = 'get_metrics', title = 'KPI' }: KpiCardProps) {
  const { data, error, loading, call } = useToolCall<KpiMetrics>(tool);

  useEffect(() => {
    void call();
  }, [call]);

  return (
    <div className="kpi-card">
      <div className="kpi-card__label">{title}</div>
      <div className="kpi-card__value">{data ? data.value.toLocaleString() : '—'}</div>
      <div className={`kpi-card__status${error ? ' kpi-card__status--error' : ''}`}>
        {error ??
          (loading ? 'loading…' : data ? `${data.label} ${data.delta >= 0 ? '▲' : '▼'}${Math.abs(data.delta)}%` : '')}
      </div>
      <button type="button" className="kpi-card__refresh" onClick={() => void call()}>
        Refresh
      </button>
    </div>
  );
}
