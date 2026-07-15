import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ERROR_CODES, MCP_APPS_RESOURCE_MIME } from '@studio/shared';
import { RpcError, type PassthroughHandler } from '@studio/host-emulator';

export const DEFAULT_SERVER_URL = 'http://localhost:3100/mcp';

/** Live-mode server URL: `?server=` query param wins, else the example server. */
export function liveServerUrl(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('server');
  return fromQuery ?? DEFAULT_SERVER_URL;
}

export interface LiveConnection {
  widgetHtml: string;
  callTool: PassthroughHandler;
  close: () => Promise<void>;
}

export async function connectMcpServer(url: string = liveServerUrl()): Promise<LiveConnection> {
  const client = new Client({ name: 'mcp-apps-studio', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));

  try {
    const list = await client.listResources();
    const uiResource =
      list.resources.find((r) => r.mimeType === MCP_APPS_RESOURCE_MIME) ??
      list.resources.find((r) => r.uri.startsWith('ui://'));
    if (!uiResource) {
      throw new Error(`Server at ${url} exposes no ui:// resources`);
    }

    const resource = await client.readResource({ uri: uiResource.uri });
    const widgetHtml = (resource.contents[0] as { text?: string } | undefined)?.text;
    if (!widgetHtml) {
      throw new Error(`Resource ${uiResource.uri} has no text content`);
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
  } catch (err) {
    await client.close();
    throw err;
  }
}
