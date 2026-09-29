import { type CallToolResult, ERROR_CODES, type MockConfig, RpcError } from '@studio/shared';

export type PassthroughHandler = (toolName: string, args: unknown) => Promise<unknown>;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const text = (value: string) => ({ type: 'text', text: value });

export class MockRouter {
  constructor(
    private config: MockConfig = {},
    private readonly passthrough?: PassthroughHandler,
  ) {}

  setConfig(config: MockConfig): void {
    this.config = config;
  }

  /** Resolves to a `CallToolResult` for mocks; passthrough returns whatever the real server answered. */
  async call(toolName: string, args: unknown): Promise<unknown> {
    const mock = this.config[toolName];
    if (!mock || mock.kind === 'passthrough') {
      if (!this.passthrough) {
        throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `No mock or passthrough for tool "${toolName}"`);
      }
      return this.passthrough(toolName, args);
    }
    if (mock.delayMs) await delay(mock.delayMs);
    switch (mock.kind) {
      case 'rpc-error':
        throw new RpcError(mock.error.code, mock.error.message);
      case 'error':
        return { isError: true, content: [text(mock.message)] } satisfies CallToolResult;
      case 'static': {
        // Servers are told to mirror structured content as text for hosts that only read `content`.
        const content = mock.content ?? (mock.structuredContent ? [text(JSON.stringify(mock.structuredContent))] : []);
        return {
          content,
          ...(mock.structuredContent ? { structuredContent: mock.structuredContent } : {}),
        } satisfies CallToolResult;
      }
    }
  }
}
