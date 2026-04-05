import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as net from 'node:net';
import * as http from 'node:http';
import { createRequest } from '../shared/protocol.js';

// ─── IPC Bridge ─────────────────────────────────────────────────

function getSocketAddress(): string {
  const addr = process.env['VMUX_SOCKET'];
  if (!addr) throw new Error('VMUX_SOCKET environment variable is not set. Ensure vmux extension is running.');
  return addr;
}

function sendViaUnixSocket(socketPath: string, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath, () => {
      client.write(payload + '\n');
    });
    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('\n')) {
        client.end();
        resolve(data.trim());
      }
    });
    client.on('error', (err) => reject(new Error(`IPC connection failed: ${err.message}`)));
    client.setTimeout(10000, () => { client.destroy(); reject(new Error('IPC timeout')); });
  });
}

function sendViaHttp(url: string, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', (err) => reject(new Error(`HTTP request failed: ${err.message}`)));
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('HTTP timeout')); });
    req.write(payload);
    req.end();
  });
}

async function rpcCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const address = getSocketAddress();
  const request = createRequest(method, params);
  const payload = JSON.stringify(request);

  let raw: string;
  if (address.startsWith('http://')) {
    raw = await sendViaHttp(address, payload);
  } else {
    raw = await sendViaUnixSocket(address, payload);
  }

  const response = JSON.parse(raw);
  if (response.error) throw new Error(response.error.message ?? 'IPC error');
  return response.result;
}

// ─── MCP Server ─────────────────────────────────────────────────

const server = new McpServer({
  name: 'vmux',
  version: '0.1.0',
});

// ── Terminal Tools ──

server.tool('create_terminal', 'Create a new terminal in VS Code', {
  name: z.string().describe('Terminal name'),
  cwd: z.string().optional().describe('Working directory'),
  shellPath: z.string().optional().describe('Shell executable path'),
}, async ({ name, cwd, shellPath }) => {
  const result = await rpcCall('terminal.create', { name, cwd, shellPath });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('list_terminals', 'List all managed terminals', {}, async () => {
  const result = await rpcCall('terminal.list');
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('send_command', 'Send text to a terminal', {
  name: z.string().describe('Terminal name'),
  text: z.string().describe('Text to send'),
}, async ({ name, text }) => {
  await rpcCall('terminal.send', { name, text });
  return { content: [{ type: 'text' as const, text: `Sent to ${name}: ${text}` }] };
});

server.tool('focus_terminal', 'Focus a terminal', {
  name: z.string().describe('Terminal name'),
}, async ({ name }) => {
  await rpcCall('terminal.focus', { name });
  return { content: [{ type: 'text' as const, text: `Focused: ${name}` }] };
});

server.tool('close_terminal', 'Close a terminal', {
  name: z.string().describe('Terminal name'),
}, async ({ name }) => {
  await rpcCall('terminal.close', { name });
  return { content: [{ type: 'text' as const, text: `Closed: ${name}` }] };
});

// ── Notification Tools ──

server.tool('create_notification', 'Send a notification to VS Code', {
  title: z.string().describe('Notification title'),
  body: z.string().optional().describe('Notification body'),
  level: z.enum(['info', 'warning', 'error']).optional().describe('Notification level'),
}, async ({ title, body, level }) => {
  const result = await rpcCall('notification.create', { title, body, level: level ?? 'info' });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('list_notifications', 'List all notifications', {}, async () => {
  const result = await rpcCall('notification.list');
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('clear_notifications', 'Clear notifications', {
  id: z.string().optional().describe('Specific notification ID to clear, or omit for all'),
}, async ({ id }) => {
  await rpcCall('notification.clear', { id });
  return { content: [{ type: 'text' as const, text: id ? `Cleared: ${id}` : 'All notifications cleared' }] };
});

// ── Metadata Tools ──

server.tool('set_status', 'Set a status pill for a terminal', {
  terminalId: z.string().describe('Terminal identifier'),
  key: z.string().describe('Status key'),
  value: z.string().describe('Status value'),
  icon: z.string().optional().describe('VS Code ThemeIcon name'),
  color: z.string().optional().describe('Hex color'),
}, async ({ terminalId, key, value, icon, color }) => {
  await rpcCall('metadata.set', { terminalId, key, value, icon, color });
  return { content: [{ type: 'text' as const, text: `Status set: ${key}=${value}` }] };
});

server.tool('set_progress', 'Set progress bar for a terminal', {
  terminalId: z.string().describe('Terminal identifier'),
  value: z.number().min(0).max(1).describe('Progress value 0.0-1.0'),
  label: z.string().optional().describe('Progress label'),
}, async ({ terminalId, value, label }) => {
  await rpcCall('metadata.progress', { terminalId, value, label });
  return { content: [{ type: 'text' as const, text: `Progress: ${Math.round(value * 100)}%${label ? ` — ${label}` : ''}` }] };
});

server.tool('add_log', 'Add a log entry for a terminal', {
  terminalId: z.string().describe('Terminal identifier'),
  message: z.string().describe('Log message'),
  level: z.enum(['info', 'progress', 'success', 'warning', 'error']).optional().describe('Log level'),
}, async ({ terminalId, message, level }) => {
  await rpcCall('metadata.log', { terminalId, message, level: level ?? 'info' });
  return { content: [{ type: 'text' as const, text: `Logged: [${level ?? 'info'}] ${message}` }] };
});

// ── Session Tools ──

server.tool('save_session', 'Save current terminal layout as a session', {
  name: z.string().describe('Session name'),
}, async ({ name }) => {
  const result = await rpcCall('session.save', { name });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('restore_session', 'Restore a saved terminal session', {
  name: z.string().describe('Session name'),
}, async ({ name }) => {
  await rpcCall('session.restore', { name });
  return { content: [{ type: 'text' as const, text: `Session restored: ${name}` }] };
});

server.tool('list_sessions', 'List saved sessions', {}, async () => {
  const result = await rpcCall('session.list');
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

// ── Agent Grid Tools ──

server.tool('launch_agent_grid', 'Create an NxM grid of split terminals', {
  name: z.string().describe('Grid name'),
  rows: z.number().min(1).describe('Number of rows'),
  cols: z.number().min(1).describe('Number of columns'),
  cwd: z.string().optional().describe('Working directory for all terminals'),
}, async ({ name, rows, cols, cwd }) => {
  const result = await rpcCall('agent.grid', { name, rows, cols, cwd });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('broadcast_to_grid', 'Send text to all terminals in a grid', {
  grid: z.string().describe('Grid name'),
  text: z.string().describe('Text to broadcast'),
}, async ({ grid, text }) => {
  await rpcCall('agent.broadcast', { grid, text });
  return { content: [{ type: 'text' as const, text: `Broadcast to ${grid}: ${text}` }] };
});

server.tool('save_agent_preset', 'Save an agent launch preset', {
  name: z.string().describe('Preset name'),
  command: z.string().optional().describe('Command to run on launch'),
  cwd: z.string().optional().describe('Working directory'),
  shellPath: z.string().optional().describe('Shell executable path'),
}, async ({ name, command, cwd, shellPath }) => {
  await rpcCall('agent.preset.save', { name, command, cwd, shellPath });
  return { content: [{ type: 'text' as const, text: `Agent preset saved: ${name}` }] };
});

server.tool('launch_agent_preset', 'Launch a terminal from a saved agent preset', {
  name: z.string().describe('Preset name'),
}, async ({ name }) => {
  const result = await rpcCall('agent.preset.launch', { name });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

// ── Tab Group Tools ──

server.tool('create_tabgroup', 'Create a tab group for organizing terminals', {
  name: z.string().describe('Tab group name'),
  color: z.string().optional().describe('Theme color identifier'),
}, async ({ name, color }) => {
  const result = await rpcCall('tabgroup.create', { name, color });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('delete_tabgroup', 'Delete a tab group', {
  name: z.string().describe('Tab group name'),
}, async ({ name }) => {
  await rpcCall('tabgroup.delete', { name });
  return { content: [{ type: 'text' as const, text: `Tab group deleted: ${name}` }] };
});

server.tool('rename_tabgroup', 'Rename a tab group', {
  oldName: z.string().describe('Current tab group name'),
  newName: z.string().describe('New tab group name'),
}, async ({ oldName, newName }) => {
  const result = await rpcCall('tabgroup.rename', { oldName, newName });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('list_tabgroups', 'List all tab groups', {}, async () => {
  const result = await rpcCall('tabgroup.list');
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('add_to_tabgroup', 'Add a terminal to a tab group', {
  group: z.string().describe('Tab group name'),
  terminal: z.string().describe('Terminal name to add'),
}, async ({ group, terminal }) => {
  const result = await rpcCall('tabgroup.addTerminal', { group, terminal });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('remove_from_tabgroup', 'Remove a terminal from a tab group', {
  group: z.string().describe('Tab group name'),
  terminal: z.string().describe('Terminal name to remove'),
}, async ({ group, terminal }) => {
  const result = await rpcCall('tabgroup.removeTerminal', { group, terminal });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

server.tool('broadcast_to_tabgroup', 'Send text to all terminals in a tab group', {
  group: z.string().describe('Tab group name'),
  text: z.string().describe('Text to broadcast'),
}, async ({ group, text }) => {
  const result = await rpcCall('tabgroup.broadcast', { group, text });
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
});

// ─── Start ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`vmux MCP server error: ${err}\n`);
  process.exit(1);
});
