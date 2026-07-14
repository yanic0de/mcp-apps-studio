import type { JsonRpcId } from './json-rpc.js';

export type RpcDirection = 'widget→host' | 'host→widget';

export interface RpcLogEvent {
  ts: number;
  direction: RpcDirection;
  kind: 'request' | 'notification' | 'response' | 'invalid';
  method?: string;
  id?: JsonRpcId;
  payload: unknown;
  error?: string;
}
