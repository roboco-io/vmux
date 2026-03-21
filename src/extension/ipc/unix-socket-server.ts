import * as net from 'node:net';
import * as fs from 'node:fs';
import type { IpcServer, RequestHandler } from './server.js';

export class UnixSocketServer implements IpcServer {
  private server: net.Server | null = null;
  private socketPath: string;
  private handleRequest: RequestHandler;

  constructor(socketPath: string, handleRequest: RequestHandler) {
    this.socketPath = socketPath;
    this.handleRequest = handleRequest;
  }

  async start(): Promise<string> {
    // Clean stale socket
    await this.cleanStaleSocket();

    return new Promise((resolve, reject) => {
      this.server = net.createServer((conn) => {
        let buffer = '';
        conn.on('data', (chunk) => {
          buffer += chunk.toString();
          // Simple newline-delimited JSON protocol
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.trim()) {
              this.handleRequest(line.trim())
                .then((response) => {
                  conn.write(response + '\n');
                })
                .catch(() => {
                  conn.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } }) + '\n');
                });
            }
          }
        });
      });

      this.server.on('error', reject);

      this.server.listen(this.socketPath, () => {
        // Set socket permissions to owner-only
        try {
          fs.chmodSync(this.socketPath, 0o600);
        } catch {
          // Best effort
        }
        resolve(this.socketPath);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.cleanupSocket();
          resolve();
        });
        // Force close existing connections
        this.server.unref();
      } else {
        resolve();
      }
    });
  }

  private async cleanStaleSocket(): Promise<void> {
    if (!fs.existsSync(this.socketPath)) return;

    // Try to connect — if it fails, it's stale
    const isAlive = await new Promise<boolean>((resolve) => {
      const client = net.createConnection(this.socketPath, () => {
        client.end();
        resolve(true);
      });
      client.on('error', () => resolve(false));
      client.setTimeout(1000, () => {
        client.destroy();
        resolve(false);
      });
    });

    if (!isAlive) {
      this.cleanupSocket();
    } else {
      throw new Error(`Socket already in use: ${this.socketPath}`);
    }
  }

  private cleanupSocket(): void {
    try {
      fs.unlinkSync(this.socketPath);
    } catch {
      // Already cleaned
    }
  }
}
