import { applyHostContextToDocument, WidgetClient } from '@studio/widget-runtime';
import { WidgetProvider } from '@studio/widget-runtime/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KpiCard } from './KpiCard.js';
import './kpi-card.css';

const client = new WidgetClient(undefined, { appInfo: { name: 'kpi-card', version: '0.1.0' } });
const ctx = await client.connect();
applyHostContextToDocument(ctx);
client.onHostContextChanged(() => {
  const current = client.getHostContext();
  if (current) applyHostContextToDocument(current);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WidgetProvider client={client}>
      <KpiCard />
    </WidgetProvider>
  </StrictMode>,
);

client.sendSizeChanged({ width: 360, height: 220 });
