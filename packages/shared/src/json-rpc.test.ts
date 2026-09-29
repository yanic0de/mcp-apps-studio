import { describe, expect, it } from 'vitest';
import { ERROR_CODES, parseJsonRpcMessage } from './json-rpc.js';

describe('parseJsonRpcMessage', () => {
  it('classifies a request (has method + id)', () => {
    const r = parseJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 't' } });
    expect(r).toMatchObject({ ok: true, kind: 'request', message: { id: 1, method: 'tools/call' } });
  });

  it('classifies a notification (method, no id)', () => {
    const r = parseJsonRpcMessage({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { width: 100 } });
    expect(r).toMatchObject({ ok: true, kind: 'notification' });
  });

  it('classifies success and error responses', () => {
    expect(parseJsonRpcMessage({ jsonrpc: '2.0', id: 'h1', result: {} })).toMatchObject({ ok: true, kind: 'response' });
    expect(parseJsonRpcMessage({ jsonrpc: '2.0', id: 'h1', error: { code: -32601, message: 'nope' } })).toMatchObject({
      ok: true,
      kind: 'response',
    });
  });

  it.each([
    null,
    42,
    'x',
    [],
    { jsonrpc: '1.0', method: 'a' },
    { jsonrpc: '2.0' },
    { jsonrpc: '2.0', id: 1, method: 5 },
  ])('rejects invalid message %#', (raw) => {
    expect(parseJsonRpcMessage(raw).ok).toBe(false);
  });

  it('exposes standard error codes', () => {
    expect(ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
  });
});
