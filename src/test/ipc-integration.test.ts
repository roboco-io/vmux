import { describe, it, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as net from 'node:net';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { MethodRouter } from '../extension/ipc/server.js';
import { UnixSocketServer } from '../extension/ipc/unix-socket-server.js';
import { HttpServer } from '../extension/ipc/http-server.js';

describe('UnixSocketServer integration', () => {
  const socketPath = path.join(os.tmpdir(), `vmux-test-${Date.now()}.sock`);
  let server: UnixSocketServer;

  after(async () => {
    if (server) await server.stop();
    try { fs.unlinkSync(socketPath); } catch { /* ok */ }
  });

  it('starts and handles JSON-RPC request', async () => {
    const router = new MethodRouter();
    router.register('ping', async () => 'pong');

    server = new UnixSocketServer(socketPath, (raw) => router.handleRaw(raw));
    await server.start();

    // Send request via net client
    const response = await new Promise<string>((resolve, reject) => {
      const client = net.createConnection(socketPath, () => {
        client.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) + '\n');
      });
      let data = '';
      client.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('\n')) {
          client.end();
          resolve(data.trim());
        }
      });
      client.on('error', reject);
    });

    const parsed = JSON.parse(response);
    assert.equal(parsed.result, 'pong');
    assert.equal(parsed.id, 1);
  });
});

describe('HttpServer integration', () => {
  let server: HttpServer;

  after(async () => {
    if (server) await server.stop();
  });

  it('starts and handles JSON-RPC request via HTTP POST', async () => {
    const router = new MethodRouter();
    router.register('ping', async () => 'pong');

    server = new HttpServer(0, (raw) => router.handleRaw(raw));
    const address = await server.start();

    const url = new URL(address);
    const response = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
      req.end();
    });

    const parsed = JSON.parse(response);
    assert.equal(parsed.result, 'pong');
    assert.equal(parsed.id, 1);
  });
});
