import { connectWidget } from '@mcp-apps-studio/widget-runtime';
import { WidgetProvider } from '@mcp-apps-studio/widget-runtime/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KpiCard } from './KpiCard.js';
import './kpi-card.css';

// The official ext-apps App: theme/variables/fonts follow the host, size is auto-reported.
const session = await connectWidget({ appInfo: { name: 'kpi-card', version: '0.1.0' } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WidgetProvider session={session}>
      <KpiCard />
    </WidgetProvider>
  </StrictMode>,
);
