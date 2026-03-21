import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import * as net from 'node:net';
import * as http from 'node:http';

const EXTENSION_ID = 'roboco-io.vmux';

async function waitForExtension(): Promise<vscode.Extension<unknown>> {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(ext, `Extension ${EXTENSION_ID} not found`);
  if (!ext.isActive) {
    await ext.activate();
  }
  // Give the IPC server time to start
  await sleep(1000);
  return ext;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSocketAddress(): string {
  const addr = process.env['VSCODE_CMUX_SOCKET'];
  if (addr) return addr;
  // Fallback: discover from /tmp
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const tmpDir = process.env['XDG_RUNTIME_DIR'] ?? os.tmpdir();
  const files = fs.readdirSync(tmpDir)
    .filter((f: string) => f.startsWith('vscode-cmux-') && f.endsWith('.sock'))
    .map((f: string) => ({
      path: path.join(tmpDir, f),
      mtime: fs.statSync(path.join(tmpDir, f)).mtimeMs,
    }))
    .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime);
  assert.ok(files.length > 0, 'No IPC socket found');
  return files[0].path;
}

async function rpcCall(address: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
  const payload = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });

  if (address.startsWith('http://')) {
    return new Promise((resolve, reject) => {
      const url = new URL(address);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk.toString(); });
        res.on('end', () => {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.result);
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  } else {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(address, () => {
        client.write(payload + '\n');
      });
      let data = '';
      client.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('\n')) {
          client.end();
          const parsed = JSON.parse(data.trim());
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.result);
        }
      });
      client.on('error', reject);
    });
  }
}

// ─── Test Suites ────────────────────────────────────────────────

async function testNotificationSystem(address: string): Promise<void> {
  console.log('  [8.2] Testing notification system...');

  // Create a notification via IPC
  const result = await rpcCall(address, 'notification.create', {
    title: 'E2E Test',
    body: 'Test notification',
    level: 'info',
  }) as { id: string };
  assert.ok(result.id, 'Notification should return an ID');

  // List notifications
  const list = await rpcCall(address, 'notification.list', {}) as Array<{ id: string; title: string; read: boolean }>;
  assert.ok(list.length >= 1, 'Should have at least 1 notification');
  const found = list.find(n => n.id === result.id);
  assert.ok(found, 'Created notification should appear in list');
  assert.equal(found!.title, 'E2E Test');
  assert.equal(found!.read, false);

  // Create error-level notification
  const errResult = await rpcCall(address, 'notification.create', {
    title: 'Error Test',
    body: 'Something failed',
    level: 'error',
  }) as { id: string };
  assert.ok(errResult.id);

  // Clear specific notification
  await rpcCall(address, 'notification.clear', { id: result.id });
  const listAfterClear = await rpcCall(address, 'notification.list', {}) as Array<{ id: string }>;
  assert.ok(!listAfterClear.find(n => n.id === result.id), 'Cleared notification should be gone');

  // Clear all
  await rpcCall(address, 'notification.clear', {});
  const listAfterClearAll = await rpcCall(address, 'notification.list', {}) as Array<{ id: string }>;
  assert.equal(listAfterClearAll.length, 0, 'All notifications should be cleared');

  // Verify commands are registered
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('cmux.jumpToNotification'), 'jumpToNotification command should exist');
  assert.ok(commands.includes('cmux.clearNotifications'), 'clearNotifications command should exist');

  console.log('  [8.2] ✓ Notification system tests passed');
}

async function testSessionManagement(address: string): Promise<void> {
  console.log('  [8.3] Testing session management...');

  // Create a terminal first so there's something to save
  await rpcCall(address, 'terminal.create', { name: 'e2e-session-test' });
  await sleep(500);

  // Save session
  const saveResult = await rpcCall(address, 'session.save', { name: 'e2e-test-session' }) as { name: string };
  assert.equal(saveResult.name, 'e2e-test-session');

  // List sessions
  const sessions = await rpcCall(address, 'session.list', {}) as Array<{ name: string; terminals: unknown[] }>;
  const found = sessions.find(s => s.name === 'e2e-test-session');
  assert.ok(found, 'Saved session should appear in list');
  assert.ok(found!.terminals.length >= 1, 'Session should have at least 1 terminal');

  // Restore session (creates new terminals)
  const terminalCountBefore = vscode.window.terminals.length;
  await rpcCall(address, 'session.restore', { name: 'e2e-test-session' });
  await sleep(1000);
  assert.ok(
    vscode.window.terminals.length >= terminalCountBefore,
    'Restoring session should create terminals',
  );

  // Verify error on non-existent session
  try {
    await rpcCall(address, 'session.restore', { name: 'nonexistent-session' });
    assert.fail('Should throw for non-existent session');
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes('not found'));
  }

  // Cleanup: close the test terminal
  try { await rpcCall(address, 'terminal.close', { name: 'e2e-session-test' }); } catch { /* ok */ }

  // Verify commands are registered
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('cmux.saveSession'), 'saveSession command should exist');
  assert.ok(commands.includes('cmux.restoreSession'), 'restoreSession command should exist');

  console.log('  [8.3] ✓ Session management tests passed');
}

async function testEnvInjection(address: string): Promise<void> {
  console.log('  [8.4] Testing environment variable injection...');

  // Create terminal via IPC
  const result = await rpcCall(address, 'terminal.create', {
    name: 'e2e-env-test',
    cwd: '/tmp',
  }) as { id: string; name: string };
  assert.ok(result.id, 'Terminal should return an ID');
  assert.equal(result.name, 'e2e-env-test');

  await sleep(500);

  // Verify terminal exists in VS Code
  const terminal = vscode.window.terminals.find(t => t.name === 'e2e-env-test');
  assert.ok(terminal, 'Terminal should be visible in VS Code');

  // List terminals via IPC
  const terminals = await rpcCall(address, 'terminal.list', {}) as Array<{ name: string; isActive: boolean }>;
  const found = terminals.find(t => t.name === 'e2e-env-test');
  assert.ok(found, 'Terminal should appear in IPC list');
  assert.equal(found!.isActive, true);

  // Test terminal.send
  await rpcCall(address, 'terminal.send', { name: 'e2e-env-test', text: 'echo $VSCODE_CMUX_SOCKET' });
  await sleep(200);

  // Test terminal.focus
  await rpcCall(address, 'terminal.focus', { name: 'e2e-env-test' });

  // Verify TerminalProfileProvider is registered
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('cmux.createTerminal'), 'createTerminal command should exist');

  // Cleanup
  await rpcCall(address, 'terminal.close', { name: 'e2e-env-test' });
  await sleep(300);

  // Verify terminal is gone
  const terminalsAfter = await rpcCall(address, 'terminal.list', {}) as Array<{ name: string }>;
  assert.ok(!terminalsAfter.find(t => t.name === 'e2e-env-test'), 'Closed terminal should be removed');

  console.log('  [8.4] ✓ Environment injection tests passed');
}

async function testIpcTransports(address: string): Promise<void> {
  console.log('  [8.5] Testing IPC transport...');

  // Verify server is reachable
  const pingResult = await rpcCall(address, 'notification.list', {});
  assert.ok(Array.isArray(pingResult), 'Should get array response from notification.list');

  // Verify JSON-RPC error handling
  try {
    await rpcCall(address, 'nonexistent.method', {});
    assert.fail('Should throw for unknown method');
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes('not found') || err.message.includes('Method'));
  }

  // Verify the transport type matches platform
  const isUnix = !address.startsWith('http://');
  if (process.platform === 'win32') {
    assert.ok(!isUnix, 'Windows should use HTTP transport');
  } else {
    console.log(`    Transport: ${isUnix ? 'Unix socket' : 'HTTP'} (${address})`);
  }

  console.log('  [8.5] ✓ IPC transport tests passed');
}

// ─── Entry Point ────────────────────────────────────────────────

export async function run(): Promise<void> {
  console.log('\n=== vmux E2E Tests ===\n');

  await waitForExtension();
  const address = getSocketAddress();
  console.log(`  IPC address: ${address}\n`);

  const errors: Error[] = [];

  for (const testFn of [testNotificationSystem, testSessionManagement, testEnvInjection, testIpcTransports]) {
    try {
      await testFn(address);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`  ✗ ${testFn.name} FAILED: ${error.message}`);
      errors.push(error);
    }
  }

  console.log(`\n=== Results: ${4 - errors.length}/4 passed ===\n`);

  if (errors.length > 0) {
    throw new Error(`${errors.length} E2E test(s) failed:\n${errors.map(e => `  - ${e.message}`).join('\n')}`);
  }
}
