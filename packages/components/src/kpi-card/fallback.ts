export interface KpiMetrics {
  value: number;
  delta: number;
  label: string;
}

/** Text-only representation for hosts without UI support (spec requirement). */
export function kpiCardTextFallback(m: KpiMetrics): string {
  return `${m.label}: ${m.value} (${m.delta >= 0 ? '+' : ''}${m.delta}%)`;
}
