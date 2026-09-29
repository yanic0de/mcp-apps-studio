import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { describe, expect, it } from 'vitest';
import { createExampleServer, KPI_RESOURCE_URI } from './server.js';

async function connect() {
  const server = createExampleServer();
  const client = new Client({ name: 'test-harness', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('example server', () => {
  it('lists get_metrics linked to the ui:// resource', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'get_metrics');
    expect(tool).toBeDefined();
    expect(tool?._meta?.ui).toMatchObject({ resourceUri: KPI_RESOURCE_URI });
  });

  it('returns structuredContent plus text fallback from tools/call', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'get_metrics', arguments: {} });
    expect(result.structuredContent).toMatchObject({
      value: expect.any(Number),
      delta: expect.any(Number),
      label: expect.any(String),
    });
    expect(result.content).toEqual([{ type: 'text', text: expect.stringContaining('Monthly active users') }]);
  });

  it('serves the widget HTML as an MCP Apps resource', async () => {
    const client = await connect();
    const res = await client.readResource({ uri: KPI_RESOURCE_URI });
    const first = res.contents[0] as { mimeType?: string; text?: string };
    expect(first.mimeType).toBe(RESOURCE_MIME_TYPE);
    expect(first.text).toContain('ui/initialize');
    expect(first.text).toContain('ui/notifications/initialized'); // SDK handshake, not just initialize
  });
});
