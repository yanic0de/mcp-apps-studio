export interface TableColumn {
  key: string;
  label: string;
}

export interface TableData {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

/** Text-only representation for hosts without UI support (spec requirement). */
export function dataTableTextFallback(data: TableData, maxRows = 5): string {
  const header = data.columns.map((c) => c.label).join(' | ');
  const visible = data.rows.slice(0, maxRows);
  const lines = visible.map((row) => data.columns.map((c) => String(row[c.key] ?? '')).join(' | '));
  const rest = data.rows.length - visible.length;
  const note = rest > 0 ? [`… ${rest} more row${rest === 1 ? '' : 's'}`] : [];
  return [header, ...lines, ...note].join('\n');
}
