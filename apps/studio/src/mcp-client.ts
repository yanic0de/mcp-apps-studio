import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { PassthroughHandler } from '@studio/host-emulator';
import { ERROR_CODES, MCP_APPS_RESOURCE_MIME, RpcError } from '@studio/shared';

export const DEFAULT_SERVER_URL = 'http://localhost:3100/mcp';

/** Live-mode server URL: `?server=` query param wins, else the example server. */
export function liveServerUrl(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('server');
  return fromQuery ?? DEFAULT_SERVER_URL;
}

export interface LiveConnection {
  /** ui:// uri of the resource the widget HTML came from. */
  widgetUri: string;
  widgetHtml: string;
  /** First tool whose `_meta.ui.resourceUri` points at the widget: the call the "model" makes in live mode. */
  linkedTool?: { name: string; [key: string]: unknown };
  callTool: PassthroughHandler;
  close: () => Promise<void>;
}

export async function connectMcpServer(url: string = liveServerUrl()): Promise<LiveConnection> {
  const client = new Client({ name: 'mcp-apps-studio', version: '0.1.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  } catch (err) {
    await client.close().catch(() => {});
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${url} — ${reason}`);
  }

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

    // The server's CallToolResult goes to the widget unchanged — isError included — exactly as a real host forwards it.
    // Only transport/protocol failures become JSON-RPC errors (MCP errors keep their code).
    const callTool: PassthroughHandler = async (toolName, args) => {
      try {
        return await client.callTool({ name: toolName, arguments: (args ?? {}) as Record<string, unknown> });
      } catch (err) {
        const code = typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : undefined;
        throw new RpcError(code ?? ERROR_CODES.INTERNAL_ERROR, err instanceof Error ? err.message : String(err));
      }
    };

    const { tools } = await client.listTools();
    const linkedTool = tools.find(
      (t) => (t._meta?.ui as { resourceUri?: unknown } | undefined)?.resourceUri === uiResource.uri,
    );

    return { widgetUri: uiResource.uri, widgetHtml, linkedTool, callTool, close: () => client.close() };
  } catch (err) {
    await client.close();
    throw err;
  }
}
