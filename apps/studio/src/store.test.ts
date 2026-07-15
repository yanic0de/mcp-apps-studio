import { beforeEach, describe, expect, it } from 'vitest';
import { defaultHostContext } from '@studio/shared';
import { scenarios, useStudioStore } from './store.js';

const initial = useStudioStore.getState();

beforeEach(() => useStudioStore.setState(initial, true));

describe('studio store', () => {
  it('starts with default context and empty log', () => {
    const s = useStudioStore.getState();
    expect(s.hostContext).toEqual(defaultHostContext);
    expect(s.scenario).toBe('default');
    expect(s.log).toEqual([]);
  });

  it('merges host context patches', () => {
    useStudioStore.getState().setHostContext({ theme: 'dark' });
    expect(useStudioStore.getState().hostContext).toMatchObject({ theme: 'dark', locale: 'en' });
  });

  it('appends and clears log', () => {
    const ev = { ts: 1, direction: 'widget→host', kind: 'request', payload: {} } as const;
    useStudioStore.getState().appendLog(ev);
    expect(useStudioStore.getState().log).toHaveLength(1);
    useStudioStore.getState().clearLog();
    expect(useStudioStore.getState().log).toEqual([]);
  });

  it('switching scenario clears the log', () => {
    useStudioStore.getState().appendLog({ ts: 1, direction: 'widget→host', kind: 'request', payload: {} });
    useStudioStore.getState().setScenario('error');
    expect(useStudioStore.getState().scenario).toBe('error');
    expect(useStudioStore.getState().log).toEqual([]);
  });

  it('defines mocks for all scenarios', () => {
    expect(Object.keys(scenarios)).toEqual(['default', 'loading', 'error', 'live']);
    expect(scenarios.error['get_metrics']).toMatchObject({ kind: 'error' });
  });

  it('live scenario has no mocks — everything goes to passthrough', () => {
    expect(scenarios.live).toEqual({});
  });
});
