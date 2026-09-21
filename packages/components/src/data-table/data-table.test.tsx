import { WidgetClient, type WidgetWindow } from '@studio/widget-runtime';
import { WidgetProvider } from '@studio/widget-runtime/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataTable } from './DataTable.js';
import { dataTableTextFallback } from './fallback.js';

const fakeWin: WidgetWindow = {
  addEventListener: () => {},
  removeEventListener: () => {},
  parent: { postMessage: () => {} },
};

describe('DataTable', () => {
  it('renders caption and placeholder before data arrives', () => {
    const html = renderToString(
      <WidgetProvider client={new WidgetClient(fakeWin)}>
        <DataTable caption="Users" />
      </WidgetProvider>,
    );
    expect(html).toContain('Users');
    expect(html).toContain('data-table');
  });
});

describe('dataTableTextFallback', () => {
  const data = {
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
    ],
    rows: [
      { name: 'Ann', age: 34 },
      { name: 'Bob', age: 28 },
      { name: 'Cid', age: 41 },
    ],
  };

  it('renders header and rows as text', () => {
    const text = dataTableTextFallback(data);
    expect(text).toContain('Name | Age');
    expect(text).toContain('Ann | 34');
    expect(text).toContain('Cid | 41');
  });

  it('truncates to maxRows with a note', () => {
    const text = dataTableTextFallback(data, 2);
    expect(text).toContain('Bob | 28');
    expect(text).not.toContain('Cid');
    expect(text).toContain('1 more row');
  });
});
