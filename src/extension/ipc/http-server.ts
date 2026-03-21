import * as http from 'node:http';
import type { IpcServer, RequestHandler } from './server.js';

export class HttpServer implements IpcServer {
  private server: http.Server | null = null;
  private port: number;
  private handleRequest: RequestHandler;

  constructor(port: number, handleRequest: RequestHandler) {
    this.port = port; // 0 = auto-assign
    this.handleRequest = handleRequest;
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
          this.handleRequest(body)
            .then((response) => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(response);
            })
            .catch(() => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } }));
            });
        });
      });

      this.server.on('error', reject);

      // Bind to localhost only
      this.server.listen(this.port, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        resolve(`http://127.0.0.1:${this.port}`);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server.unref();
      } else {
        resolve();
      }
    });
  }
}
