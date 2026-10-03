import { MCP_APPS_METHODS, type RpcLogEvent, type Step } from '@studio/shared';

export type ActionStep = Extract<Step, { click: string } | { fill: string } | { press: string }>;
export type ExpectStep = Exclude<Step, ActionStep>;

export const isAction = (step: Step): step is ActionStep => 'click' in step || 'fill' in step || 'press' in step;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * `expected` is contained in `actual`: objects key by key (extra actual keys allowed), arrays element by
 * element at equal length, primitives by strict equality.
 */
export function isSubset(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => isSubset(actual[i], e))
    );
  }
  if (isPlainObject(expected)) {
    return isPlainObject(actual) && Object.entries(expected).every(([k, e]) => isSubset(actual[k], e));
  }
  return actual === expected;
}

const paramsOf = (ev: RpcLogEvent) => (ev.payload as { params?: unknown } | undefined)?.params;

const methodOf = (step: ExpectStep) =>
  'expectToolCall' in step ? MCP_APPS_METHODS.toolsCall : step.expectMessage.method;

/** Widget-sent requests (and, for `expectMessage`, notifications) carrying the step's method. */
function candidates(log: RpcLogEvent[], step: ExpectStep): number[] {
  const method = methodOf(step);
  const kinds = 'expectToolCall' in step ? ['request'] : ['request', 'notification'];
  return log.flatMap((ev, i) =>
    ev.direction === 'widget→host' && ev.method === method && kinds.includes(ev.kind) ? [i] : [],
  );
}

function satisfies(ev: RpcLogEvent, step: ExpectStep): boolean {
  const params = paramsOf(ev);
  if ('expectToolCall' in step) {
    const { name, arguments: args } = step.expectToolCall;
    if (!isPlainObject(params) || params.name !== name) return false;
    return args === undefined || isSubset(params.arguments ?? {}, args);
  }
  const expected = step.expectMessage.params;
  return expected === undefined || isSubset(params, expected);
}

/** Trace index of the earliest message meeting the expectation that no earlier expectation consumed. */
export function matchStep(log: RpcLogEvent[], step: ExpectStep, consumed: ReadonlySet<number>): number | undefined {
  return candidates(log, step).find((i) => !consumed.has(i) && satisfies(log[i] as RpcLogEvent, step));
}

export function stepSummary(step: Step): string {
  if ('click' in step) return `click ${step.click}`;
  if ('fill' in step) return `fill ${step.fill}`;
  if ('press' in step) return step.on ? `press ${step.press} on ${step.on}` : `press ${step.press}`;
  if ('expectToolCall' in step) return `expectToolCall ${step.expectToolCall.name}`;
  return `expectMessage ${step.expectMessage.method}`;
}

const MAX_SEEN = 200;
const clip = (s: string) => (s.length > MAX_SEEN ? `${s.slice(0, MAX_SEEN)}…` : s);

/** Why an expectation was not met: what was seen with that method, so the fix is obvious from the report. */
export function unmetReason(log: RpcLogEvent[], step: ExpectStep, timeoutMs: number): string {
  const method = methodOf(step);
  const seen = candidates(log, step).map((i) => {
    const params = paramsOf(log[i] as RpcLogEvent);
    if ('expectToolCall' in step && isPlainObject(params)) {
      return clip(`${String(params.name)} ${JSON.stringify(params.arguments ?? {})}`);
    }
    return clip(JSON.stringify(params ?? {}));
  });
  if (seen.length === 0) return `no ${method} seen within ${timeoutMs} ms`;
  return `no matching ${method} within ${timeoutMs} ms; seen: ${seen.join(', ')}`;
}
