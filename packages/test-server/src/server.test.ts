import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { INSPECTOR_RESOURCE_URI, TOTAL_ROWS, createTestServer } from './server.js';

async function connect() {
  const server = createTestServer();
  const client = new Client({ name: 'test-harness', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('test server', () => {
  it('lists all polygon tools, each linked to the inspector widget', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['counter', 'echo', 'fail', 'get_rows', 'slow_metrics']);
    for (const tool of tools) {
      expect(tool._meta?.['ui']).toMatchObject({ resourceUri: INSPECTOR_RESOURCE_URI });
    }
  });

  it('echo returns its arguments as structuredContent', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
    expect(result.structuredContent).toEqual({ echoed: { message: 'hello' } });
  });

  it('fail returns an isError tool result with the message', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'fail', arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Intentional failure');
  });

  it('get_rows paginates deterministic rows', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'get_rows', arguments: { page: 2, pageSize: 5 } });
    const data = result.structuredContent as { rows: { name: string }[]; total: number; page: number };
    expect(data.total).toBe(TOTAL_ROWS);
    expect(data.page).toBe(2);
    expect(data.rows).toHaveLength(5);
    expect(data.rows[0]?.name).toBe('Row 6');
    expect(data.rows[4]?.name).toBe('Row 10');
  });

  it('counter keeps module-level state across calls', async () => {
    const client = await connect();
    const first = (await client.callTool({ name: 'counter', arguments: { by: 2 } })).structuredContent as { count: number };
    const second = (await client.callTool({ name: 'counter', arguments: {} })).structuredContent as { count: number };
    expect(second.count).toBe(first.count + 1);
  });

  it('slow_metrics returns metrics after the requested delay', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'slow_metrics', arguments: { delayMs: 0 } });
    expect(result.structuredContent).toMatchObject({ value: expect.any(Number), label: expect.any(String) });
  });

  it('serves the inspector widget as an MCP Apps resource', async () => {
    const client = await connect();
    const list = await client.listResources();
    expect(list.resources.some((r) => r.uri === INSPECTOR_RESOURCE_URI)).toBe(true);
    const res = await client.readResource({ uri: INSPECTOR_RESOURCE_URI });
    const first = res.contents[0] as { mimeType?: string; text?: string };
    expect(first.mimeType).toBe('text/html;profile=mcp-app');
    expect(first.text).toContain('ui/initialize');
  });
});
