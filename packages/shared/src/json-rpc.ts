import { z } from 'zod';

export const JSON_RPC_VERSION = '2.0' as const;

export const jsonRpcIdSchema = z.union([z.string(), z.number()]);
export type JsonRpcId = z.infer<typeof jsonRpcIdSchema>;

export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal(JSON_RPC_VERSION),
  id: jsonRpcIdSchema,
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;

export const jsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal(JSON_RPC_VERSION),
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;

export const jsonRpcErrorObjectSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type JsonRpcErrorObject = z.infer<typeof jsonRpcErrorObjectSchema>;

export const jsonRpcResponseSchema = z.union([
  z.object({ jsonrpc: z.literal(JSON_RPC_VERSION), id: jsonRpcIdSchema, result: z.unknown() }),
  z.object({ jsonrpc: z.literal(JSON_RPC_VERSION), id: jsonRpcIdSchema.nullable(), error: jsonRpcErrorObjectSchema }),
]);
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

export const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  REQUEST_TIMEOUT: -32001,
  RESOURCE_NOT_FOUND: -32002,
  TOOL_ERROR: -32000,
} as const;

export type ParsedJsonRpc =
  | { ok: true; kind: 'request'; message: JsonRpcRequest }
  | { ok: true; kind: 'notification'; message: JsonRpcNotification }
  | { ok: true; kind: 'response'; message: JsonRpcResponse }
  | { ok: false; error: string };

/** Human-readable zod issues: `path: message; path: message`. */
export function formatZodIssues(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

export function parseJsonRpcMessage(raw: unknown): ParsedJsonRpc {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'message is not an object' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.jsonrpc !== JSON_RPC_VERSION) {
    return { ok: false, error: 'missing or invalid "jsonrpc" field' };
  }
  if ('method' in obj) {
    if ('id' in obj) {
      const r = jsonRpcRequestSchema.safeParse(obj);
      return r.success
        ? { ok: true, kind: 'request', message: r.data }
        : { ok: false, error: formatZodIssues(r.error) };
    }
    const n = jsonRpcNotificationSchema.safeParse(obj);
    return n.success
      ? { ok: true, kind: 'notification', message: n.data }
      : { ok: false, error: formatZodIssues(n.error) };
  }
  if ('result' in obj || 'error' in obj) {
    const resp = jsonRpcResponseSchema.safeParse(obj);
    return resp.success
      ? { ok: true, kind: 'response', message: resp.data }
      : { ok: false, error: formatZodIssues(resp.error) };
  }
  return { ok: false, error: 'not a request, notification, or response' };
}
