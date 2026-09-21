import fs from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const INSPECTOR_RESOURCE_URI = 'ui://test/inspector.html';
export const TOTAL_ROWS = 42;

// Module-level on purpose: survives the stateless per-request server instances,
// so the studio can observe state shared across tool calls.
let counterValue = 0;

const ui = { _meta: { ui: { resourceUri: INSPECTOR_RESOURCE_URI } } };

/**
 * Test polygon for the studio: every tool exercises one host-emulator behavior
 * (round-trip, latency, tool error, pagination, cross-call state).
 */
export function createTestServer(): McpServer {
  const server = new McpServer({ name: 'studio-test-server', version: '0.1.0' });

  registerAppTool(
    server,
    'echo',
    {
      title: 'Echo',
      description: 'Returns its arguments back as structuredContent.',
      inputSchema: { message: z.string().default('ping') },
      annotations: { readOnlyHint: true },
      ...ui,
    },
    async (args) => ({
      content: [{ type: 'text', text: `echo: ${args.message}` }],
      structuredContent: { echoed: args },
    }),
  );

  registerAppTool(
    server,
    'slow_metrics',
    {
      title: 'Slow metrics',
      description: 'Returns KPI metrics after a configurable delay — for loading states against a real server.',
      inputSchema: { delayMs: z.number().int().min(0).max(10_000).default(1500) },
      annotations: { readOnlyHint: true },
      ...ui,
    },
    async (args) => {
      await sleep(args.delayMs);
      const metrics = { value: 12840, delta: 8.3, label: `Metrics after ${args.delayMs}ms` };
      return {
        content: [{ type: 'text', text: `${metrics.label}: ${metrics.value}` }],
        structuredContent: metrics,
      };
    },
  );

  registerAppTool(
    server,
    'fail',
    {
      title: 'Fail',
      description: 'Always fails with a tool error (isError result).',
      inputSchema: { message: z.string().default('Intentional failure') },
      ...ui,
    },
    async (args) => ({
      isError: true,
      content: [{ type: 'text', text: args.message }],
    }),
  );

  registerAppTool(
    server,
    'get_rows',
    {
      title: 'Get rows',
      description: 'Deterministic paginated table data.',
      inputSchema: {
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      },
      annotations: { readOnlyHint: true },
      ...ui,
    },
    async (args) => {
      const start = (args.page - 1) * args.pageSize;
      const rows = Array.from({ length: Math.max(0, Math.min(args.pageSize, TOTAL_ROWS - start)) }, (_, i) => {
        const n = start + i + 1;
        return { name: `Row ${n}`, value: n * 10, even: n % 2 === 0 };
      });
      const data = {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'value', label: 'Value' },
          { key: 'even', label: 'Even' },
        ],
        rows,
        total: TOTAL_ROWS,
        page: args.page,
      };
      return {
        content: [{ type: 'text', text: `rows ${start + 1}–${start + rows.length} of ${TOTAL_ROWS}` }],
        structuredContent: data,
      };
    },
  );

  registerAppTool(
    server,
    'counter',
    {
      title: 'Counter',
      description: 'Increments server-side state shared across calls.',
      inputSchema: { by: z.number().int().default(1) },
      ...ui,
    },
    async (args) => {
      counterValue += args.by;
      return {
        content: [{ type: 'text', text: `count: ${counterValue}` }],
        structuredContent: { count: counterValue },
      };
    },
  );

  registerAppResource(
    server,
    'Protocol Inspector',
    INSPECTOR_RESOURCE_URI,
    { description: 'Widget with a button per tool; shows raw request/response JSON.', mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: INSPECTOR_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await fs.readFile(new URL('./inspector.html', import.meta.url), 'utf8'),
        },
      ],
    }),
  );

  return server;
}
