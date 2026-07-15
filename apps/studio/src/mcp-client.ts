import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ERROR_CODES } from '@studio/shared';
import { RpcError, type PassthroughHandler } from '@studio/host-emulator';

export const EXAMPLE_SERVER_URL = 'http://localhost:3100/mcp';
export const KPI_RESOURCE_URI = 'ui://example/kpi-card.html';

export interface LiveConnection {
  widgetHtml: string;
  callTool: PassthroughHandler;
  close: () => Promise<void>;
}

export async function connectExampleServer(url: string = EXAMPLE_SERVER_URL): Promise<LiveConnection> {
  const client = new Client({ name: 'mcp-apps-studio', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));

  const resource = await client.readResource({ uri: KPI_RESOURCE_URI });
  const widgetHtml = (resource.contents[0] as { text?: string } | undefined)?.text;
  if (!widgetHtml) {
    await client.close();
    throw new Error(`Resource ${KPI_RESOURCE_URI} has no text content`);
  }

  const callTool: PassthroughHandler = async (toolName, args) => {
    const result = await client.callTool({ name: toolName, arguments: (args ?? {}) as Record<string, unknown> });
    if (result.isError) {
      const text = Array.isArray(result.content)
        ? result.content.map((c) => ('text' in c ? c.text : '')).join(' ')
        : 'tool call failed';
      throw new RpcError(ERROR_CODES.TOOL_ERROR, (typeof text === 'string' && text.trim()) || 'tool call failed');
    }
    // MVP simplification: widgets get structuredContent when the tool provides it.
    return result.structuredContent ?? result;
  };

  return { widgetHtml, callTool, close: () => client.close() };
}
