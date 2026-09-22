import { applyHostContextToDocument, WidgetClient } from '@studio/widget-runtime';
import { WidgetProvider } from '@studio/widget-runtime/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DataTable } from './DataTable.js';
import './data-table.css';

const client = new WidgetClient(undefined, { appInfo: { name: 'data-table', version: '0.1.0' } });
const ctx = await client.connect();
applyHostContextToDocument(ctx);
client.onHostContextChanged(() => {
  const current = client.getHostContext();
  if (current) applyHostContextToDocument(current);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WidgetProvider client={client}>
      <DataTable caption="Users" />
    </WidgetProvider>
  </StrictMode>,
);

client.sendSizeChanged({ width: 480, height: 280 });
