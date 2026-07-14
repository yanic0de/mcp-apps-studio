export type ToolMock =
  | { kind: 'static'; result: unknown; delayMs?: number }
  | { kind: 'error'; error: { code: number; message: string }; delayMs?: number }
  | { kind: 'passthrough' };

export type MockConfig = Record<string, ToolMock>;
