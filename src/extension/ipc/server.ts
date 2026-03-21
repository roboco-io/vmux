import {
  type JsonRpcRequest,
  type MethodHandler,
  createError,
  createResponse,
  parseMessage,
  PARSE_ERROR,
  METHOD_NOT_FOUND,
  INVALID_PARAMS,
  INTERNAL_ERROR,
} from '../../shared/protocol.js';

export interface IpcServer {
  start(): Promise<string>; // returns address (socket path or http url)
  stop(): Promise<void>;
}

export type RequestHandler = (raw: string) => Promise<string>;

export class MethodRouter {
  private handlers = new Map<string, MethodHandler>();

  register(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }

  async handleRaw(raw: string): Promise<string> {
    let request: JsonRpcRequest;
    try {
      request = parseMessage(raw);
    } catch {
      return JSON.stringify(createError(null, PARSE_ERROR, 'Parse error'));
    }

    const handler = this.handlers.get(request.method);
    if (!handler) {
      return JSON.stringify(
        createError(request.id, METHOD_NOT_FOUND, `Method not found: ${request.method}`)
      );
    }

    try {
      const result = await handler(request.params ?? {});
      return JSON.stringify(createResponse(request.id, result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Distinguish validation errors from internal errors
      if (message.startsWith('Invalid params:')) {
        return JSON.stringify(createError(request.id, INVALID_PARAMS, message));
      }
      return JSON.stringify(createError(request.id, INTERNAL_ERROR, message));
    }
  }
}

export function createMethodRouter(): MethodRouter {
  return new MethodRouter();
}
