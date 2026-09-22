import { MCP_APPS_METHODS, type RpcLogEvent, scenarioSchema } from '@studio/shared';
import { describe, expect, it } from 'vitest';
import { recordScenario, scenarioSnippet } from './record.js';

let ts = 0;
const req = (id: string, name: string, args: unknown = {}): RpcLogEvent => ({
  ts: ts++,
  direction: 'widget→host',
  kind: 'request',
  method: MCP_APPS_METHODS.toolsCall,
  id,
  payload: { jsonrpc: '2.0', id, method: MCP_APPS_METHODS.toolsCall, params: { name, arguments: args } },
});
const res = (id: string, body: { result?: unknown; error?: unknown }): RpcLogEvent => ({
  ts: ts++,
  direction: 'host→widget',
  kind: 'response',
  id,
  payload: { jsonrpc: '2.0', id, ...body },
});
const note = (method: string, params: unknown): RpcLogEvent => ({
  ts: ts++,
  direction: 'host→widget',
  kind: 'notification',
  method,
  payload: { jsonrpc: '2.0', method, params },
});

describe('recordScenario', () => {
  it('turns answered tool calls into mocks, last answer per tool winning', () => {
    const log = [
      req('w1', 'get_metrics'),
      res('w1', { result: { content: [{ type: 'text', text: 'old' }], structuredContent: { v: 1 } } }),
      req('w2', 'get_metrics'),
      res('w2', { result: { content: [{ type: 'text', text: 'new' }], structuredContent: { v: 2 } } }),
      req('w3', 'unanswered'),
    ];
    expect(recordScenario(log)).toEqual({
      mocks: {
        get_metrics: { kind: 'static', content: [{ type: 'text', text: 'new' }], structuredContent: { v: 2 } },
      },
    });
  });

  it('records isError results as error mocks and JSON-RPC errors as rpc-error mocks', () => {
    const log = [
      req('w1', 'fail'),
      res('w1', { result: { isError: true, content: [{ type: 'text', text: 'Intentional failure' }] } }),
      req('w2', 'ghost'),
      res('w2', { error: { code: -32601, message: 'nope' } }),
    ];
    expect(recordScenario(log).mocks).toEqual({
      fail: { kind: 'error', message: 'Intentional failure' },
      ghost: { kind: 'rpc-error', error: { code: -32601, message: 'nope' } },
    });
  });

  it('records the pushed lifecycle as the toolCall', () => {
    const log = [
      note(MCP_APPS_METHODS.toolInput, { arguments: { q: 1 } }),
      note(MCP_APPS_METHODS.toolResult, { content: [], structuredContent: { v: 1 } }),
    ];
    expect(recordScenario(log, 'get_metrics')).toEqual({
      mocks: {},
      toolCall: {
        name: 'get_metrics',
        input: { q: 1 },
        result: { kind: 'static', content: [], structuredContent: { v: 1 } },
      },
    });
  });

  it('records a cancellation', () => {
    const log = [note(MCP_APPS_METHODS.toolInput, {}), note(MCP_APPS_METHODS.toolCancelled, { reason: 'boom' })];
    expect(recordScenario(log, 't').toolCall).toEqual({
      name: 't',
      input: {},
      result: { kind: 'cancelled', reason: 'boom' },
    });
  });

  it('always yields a scenario the story schema accepts', () => {
    const log = [
      note(MCP_APPS_METHODS.toolInput, { arguments: { a: 1 } }),
      note(MCP_APPS_METHODS.toolResult, { isError: true, content: [] }),
      req('w1', 'x'),
      res('w1', { result: { content: [] } }),
    ];
    expect(scenarioSchema.safeParse(recordScenario(log, 'x')).success).toBe(true);
  });
});

describe('scenarioSnippet', () => {
  it('names the scenario and pretty-prints it', () => {
    expect(scenarioSnippet('recorded-1', { mocks: {} })).toBe('"recorded-1": {\n  "mocks": {}\n},');
  });
});
