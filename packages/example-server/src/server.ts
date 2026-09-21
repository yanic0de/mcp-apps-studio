import fs from 'node:fs/promises';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const KPI_RESOURCE_URI = 'ui://example/kpi-card.html';

export function createExampleServer(): McpServer {
  const server = new McpServer({ name: 'studio-example-server', version: '0.1.0' });

  registerAppTool(
    server,
    'get_metrics',
    {
      title: 'Get metrics',
      description: 'Returns the current KPI metrics.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: KPI_RESOURCE_URI } },
    },
    async () => {
      const metrics = { value: 12840, delta: 8.3, label: 'Monthly active users' };
      return {
        // Text fallback is mandatory: hosts without UI support render only this.
        content: [
          {
            type: 'text',
            text: `${metrics.label}: ${metrics.value} (${metrics.delta >= 0 ? '+' : ''}${metrics.delta}%)`,
          },
        ],
        structuredContent: metrics,
      };
    },
  );

  registerAppResource(
    server,
    'KPI Card',
    KPI_RESOURCE_URI,
    { description: 'KPI card widget UI', mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: KPI_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await fs.readFile(new URL('./kpi-card.html', import.meta.url), 'utf8'),
        },
      ],
    }),
  );

  return server;
}
