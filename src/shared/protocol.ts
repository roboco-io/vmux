// JSON-RPC 2.0 base types

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// Error codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

// Method parameter types

export interface NotificationCreateParams {
  title: string;
  body?: string;
  level?: 'info' | 'warning' | 'error';
  terminalId?: string;
}

export interface NotificationClearParams {
  id?: string;
}

export interface TerminalCreateParams {
  name: string;
  cwd?: string;
  env?: Record<string, string>;
  shellPath?: string;
}

export interface TerminalSendParams {
  name: string;
  text: string;
}

export interface TerminalTargetParams {
  name: string;
}

export interface SessionNameParams {
  name: string;
}

// Phase 2: Metadata methods

export interface MetadataSetParams {
  terminalId: string;
  key: string;
  value: string;
  icon?: string;
  color?: string;
}

export interface MetadataGetParams {
  terminalId: string;
}

export interface ProgressSetParams {
  terminalId: string;
  value: number;
  label?: string;
}

export interface LogAddParams {
  terminalId: string;
  message: string;
  level?: 'info' | 'progress' | 'success' | 'warning' | 'error';
}

// Method handler type
export type MethodHandler = (params: Record<string, unknown>) => Promise<unknown>;

// Utility functions

let _nextId = 1;

export function createRequest(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return { jsonrpc: '2.0', id: _nextId++, method, params };
}

export function createResponse(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function createError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

export function parseMessage(data: string): JsonRpcRequest {
  const parsed = JSON.parse(data);
  if (parsed.jsonrpc !== '2.0' || typeof parsed.method !== 'string') {
    throw new Error('Invalid JSON-RPC 2.0 request');
  }
  return parsed as JsonRpcRequest;
}
