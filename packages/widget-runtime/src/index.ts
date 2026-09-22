// Widgets depend only on widget-runtime; re-export the error type tool calls reject with.
export { type CallToolResult, RpcError } from '@studio/shared';
export * from './client.js';
export * from './dom.js';
export * from './tool-result.js';
