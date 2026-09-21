import { ERROR_CODES, type MockConfig, RpcError } from '@studio/shared';

export type PassthroughHandler = (toolName: string, args: unknown) => Promise<unknown>;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class MockRouter {
  constructor(
    private config: MockConfig = {},
    private readonly passthrough?: PassthroughHandler,
  ) {}

  setConfig(config: MockConfig): void {
    this.config = config;
  }

  async call(toolName: string, args: unknown): Promise<unknown> {
    const mock = this.config[toolName];
    if (!mock || mock.kind === 'passthrough') {
      if (!this.passthrough) {
        throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `No mock or passthrough for tool "${toolName}"`);
      }
      return this.passthrough(toolName, args);
    }
    if (mock.delayMs) await delay(mock.delayMs);
    if (mock.kind === 'error') {
      throw new RpcError(mock.error.code, mock.error.message);
    }
    return mock.result;
  }
}
