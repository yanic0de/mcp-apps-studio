import { MCP_APPS_METHODS, type RpcLogEvent, type Step } from '@studio/shared';
import { describe, expect, it } from 'vitest';
import { isAction, isSubset, matchStep, stepSummary, unmetReason } from './steps.js';

const call = (id: number, name: string, args?: Record<string, unknown>): RpcLogEvent => ({
  ts: id,
  direction: 'widget→host',
  kind: 'request',
  id,
  method: MCP_APPS_METHODS.toolsCall,
  payload: { jsonrpc: '2.0', id, method: MCP_APPS_METHODS.toolsCall, params: { name, arguments: args } },
});

describe('isSubset', () => {
  it('matches nested objects key by key, ignoring extra actual keys', () => {
    expect(isSubset({ page: 2, size: 20, filter: { q: 'a', x: 1 } }, { page: 2, filter: { q: 'a' } })).toBe(true);
    expect(isSubset({ page: 1 }, { page: 2 })).toBe(false);
    expect(isSubset({}, { page: 2 })).toBe(false);
    expect(isSubset(null, { page: 2 })).toBe(false);
  });

  it('matches arrays element by element at equal length', () => {
    expect(isSubset([{ a: 1, b: 2 }, 3], [{ a: 1 }, 3])).toBe(true);
    expect(isSubset([1, 2, 3], [1, 2])).toBe(false);
    expect(isSubset({ 0: 1 }, [1])).toBe(false);
  });

  it('matches primitives by strict equality', () => {
    expect(isSubset('2', 2)).toBe(false);
    expect(isSubset(true, true)).toBe(true);
    expect(isSubset(null, null)).toBe(true);
  });
});

describe('matchStep', () => {
  it('matches a tool call by name and argument subset', () => {
    const log = [call(1, 'get_rows', { page: 1 }), call(2, 'get_rows', { page: 2, size: 20 })];
    const step: Step = { expectToolCall: { name: 'get_rows', arguments: { page: 2 } } };
    expect(matchStep(log, step, new Set())).toBe(1);
  });

  it('lets one call satisfy only one expectation, earliest first', () => {
    const log = [call(1, 'get_metrics')];
    const step: Step = { expectToolCall: { name: 'get_metrics' } };
    const consumed = new Set<number>();
    const first = matchStep(log, step, consumed);
    expect(first).toBe(0);
    consumed.add(first as number);
    expect(matchStep(log, step, consumed)).toBeUndefined();
  });

  it('matches widget requests and notifications by method and params subset, never host messages', () => {
    const log: RpcLogEvent[] = [
      {
        ts: 1,
        direction: 'host→widget',
        kind: 'notification',
        method: 'ui/open-link',
        payload: { params: { url: 'https://x' } },
      },
      {
        ts: 2,
        direction: 'widget→host',
        kind: 'request',
        id: 5,
        method: 'ui/open-link',
        payload: { params: { url: 'https://x', target: '_blank' } },
      },
    ];
    expect(matchStep(log, { expectMessage: { method: 'ui/open-link', params: { url: 'https://x' } } }, new Set())).toBe(
      1,
    );
    expect(matchStep(log, { expectMessage: { method: 'ui/open-link', params: { url: 'https://y' } } }, new Set())).toBe(
      undefined,
    );
  });
});

describe('step text', () => {
  it('summarizes each step kind', () => {
    expect(stepSummary({ click: '#nope' })).toBe('click #nope');
    expect(stepSummary({ fill: 'input', value: 'x' })).toBe('fill input');
    expect(stepSummary({ press: 'Enter', on: 'input' })).toBe('press Enter on input');
    expect(stepSummary({ expectToolCall: { name: 'get_rows' } })).toBe('expectToolCall get_rows');
    expect(stepSummary({ expectMessage: { method: 'ui/open-link' } })).toBe('expectMessage ui/open-link');
  });

  it('quotes the arguments of the calls that were seen', () => {
    const reason = unmetReason(
      [call(1, 'get_rows', { page: 1 })],
      {
        expectToolCall: { name: 'get_rows', arguments: { page: 2 } },
      },
      5000,
    );
    expect(reason).toContain('within 5000 ms');
    expect(reason).toContain('get_rows {"page":1}');
  });

  it('says when nothing with that method was seen, and cuts long params', () => {
    expect(unmetReason([], { expectMessage: { method: 'ui/message' } }, 100)).toBe('no ui/message seen within 100 ms');
    const long = unmetReason([call(1, 'big', { s: 'x'.repeat(500) })], { expectToolCall: { name: 'big' } }, 1);
    expect(long.length).toBeLessThan(300);
  });

  it('tells actions from expectations', () => {
    expect(isAction({ click: 'a' })).toBe(true);
    expect(isAction({ expectToolCall: { name: 'a' } })).toBe(false);
  });
});
