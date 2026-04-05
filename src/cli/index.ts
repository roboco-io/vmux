import * as net from 'node:net';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createRequest } from '../shared/protocol.js';
import { runChainedCodexNotify } from './codex-notify-chain.js';

// ─── Argv Parser ────────────────────────────────────────────────

interface ParsedArgs {
  command: string;
  flags: Record<string, string>;
  positional: string[];
}

function parseArgv(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] ?? '';
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

// ─── Socket Discovery ───────────────────────────────────────────

function discoverSocket(flags: Record<string, string>): string {
  // 1. --socket flag (highest priority)
  if (flags['socket']) return flags['socket'];

  // 2. VMUX_SOCKET env
  const envSocket = process.env['VMUX_SOCKET'];
  if (envSocket) return envSocket;

  // 3. Glob for /tmp/vmux-*.sock (most recent)
  const tmpDir = process.env['XDG_RUNTIME_DIR'] ?? os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith('vmux-') && f.endsWith('.sock'))
      .map(f => {
        const full = path.join(tmpDir, f);
        return { path: full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) return files[0]!.path;
  } catch {
    // ignore
  }

  throw new Error(
    'Cannot find IPC server. Ensure VS Code with vmux extension is running.\n' +
    'Set VMUX_SOCKET or use --socket <path>.'
  );
}

// ─── JSON-RPC Client ────────────────────────────────────────────

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

    client.on('error', (err) => reject(new Error(`Connection failed: ${err.message}`)));
    client.setTimeout(10000, () => {
      client.destroy();
      reject(new Error('Connection timeout'));
    });
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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('HTTP request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

async function rpcCall(address: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
  const request = createRequest(method, params);
  const payload = JSON.stringify(request);

  let raw: string;
  if (address.startsWith('http://') || address.startsWith('https://')) {
    raw = await sendViaHttp(address, payload);
  } else {
    raw = await sendViaUnixSocket(address, payload);
  }

  const response = JSON.parse(raw);
  if (response.error) {
    throw new Error(response.error.message ?? 'RPC error');
  }
  return response.result;
}

// ─── Commands ───────────────────────────────────────────────────

function printResult(result: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (typeof result === 'string') {
    process.stdout.write(result + '\n');
  } else if (result !== null && result !== undefined) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
}

async function runCommand(address: string, parsed: ParsedArgs): Promise<void> {
  const json = parsed.flags['json'] === 'true';
  const terminalKey = parsed.flags['terminal-id']
    ?? parsed.flags['terminal']
    ?? process.env['VMUX_TERMINAL_NAME']
    ?? process.env['VMUX_TERMINAL_ID']
    ?? '';

  switch (parsed.command) {
    case 'ping': {
      const result = await rpcCall(address, 'ping', {});
      printResult(result, json);
      break;
    }

    // ── Notifications ──
    case 'notify': {
      const title = parsed.flags['title'];
      if (!title) throw new Error('--title is required');
      const result = await rpcCall(address, 'notification.create', {
        title,
        body: parsed.flags['body'],
        level: parsed.flags['level'] ?? 'info',
        terminalId: terminalKey || undefined,
      });
      printResult(result, json);
      break;
    }
    case 'list-notifications': {
      const result = await rpcCall(address, 'notification.list', {});
      printResult(result, json);
      break;
    }
    case 'clear-notifications': {
      const result = await rpcCall(address, 'notification.clear', {
        id: parsed.flags['id'],
        terminalId: parsed.flags['terminal'],
      });
      printResult(result, json);
      break;
    }

    // ── Terminals ──
    case 'create-terminal': {
      const name = parsed.flags['name'];
      if (!name) throw new Error('--name is required');
      const result = await rpcCall(address, 'terminal.create', {
        name,
        cwd: parsed.flags['cwd'],
        shellPath: parsed.flags['shell'],
      });
      printResult(result, json);
      break;
    }
    case 'list-terminals': {
      const result = await rpcCall(address, 'terminal.list', {});
      printResult(result, json);
      break;
    }
    case 'send': {
      const name = parsed.flags['terminal'];
      const text = parsed.positional[0];
      if (!name) throw new Error('--terminal is required');
      if (!text) throw new Error('text argument is required');
      const result = await rpcCall(address, 'terminal.send', { name, text });
      printResult(result, json);
      break;
    }
    case 'focus': {
      const name = parsed.flags['terminal'];
      if (!name) throw new Error('--terminal is required');
      const result = await rpcCall(address, 'terminal.focus', { name });
      printResult(result, json);
      break;
    }
    case 'close': {
      const name = parsed.flags['terminal'];
      if (!name) throw new Error('--terminal is required');
      const result = await rpcCall(address, 'terminal.close', { name });
      printResult(result, json);
      break;
    }

    // ── Sessions ──
    case 'save-session': {
      const name = parsed.flags['name'];
      if (!name) throw new Error('--name is required');
      const result = await rpcCall(address, 'session.save', { name });
      printResult(result, json);
      break;
    }
    case 'restore-session': {
      const name = parsed.flags['name'];
      if (!name) throw new Error('--name is required');
      const result = await rpcCall(address, 'session.restore', { name });
      printResult(result, json);
      break;
    }
    case 'list-sessions': {
      const result = await rpcCall(address, 'session.list', {});
      printResult(result, json);
      break;
    }

    // ── Metadata ──
    case 'set-status': {
      const key = parsed.positional[0];
      const value = parsed.positional[1];
      const terminalId = terminalKey;
      if (!key || !value) throw new Error('<key> and <value> arguments are required');
      const result = await rpcCall(address, 'metadata.set', {
        terminalId, key, value,
        icon: parsed.flags['icon'],
        color: parsed.flags['color'],
      });
      printResult(result, json);
      break;
    }
    case 'set-progress': {
      const value = parseFloat(parsed.positional[0] ?? '');
      const terminalId = terminalKey;
      if (isNaN(value)) throw new Error('<value> argument (0.0-1.0) is required');
      const result = await rpcCall(address, 'metadata.progress', {
        terminalId, value,
        label: parsed.flags['label'],
      });
      printResult(result, json);
      break;
    }
    case 'log': {
      const message = parsed.positional[0];
      const terminalId = terminalKey;
      if (!message) throw new Error('<message> argument is required');
      const result = await rpcCall(address, 'metadata.log', {
        terminalId, message,
        level: parsed.flags['level'] ?? 'info',
      });
      printResult(result, json);
      break;
    }

    // ── Claude Hooks ──
    case 'claude-hook': {
      const action = parsed.positional[0];
      if (!action) throw new Error('<action> argument is required');
      const rawInput = await new Promise<string>((resolve, reject) => {
        if (process.stdin.isTTY) {
          resolve('');
          return;
        }
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => {
          data += chunk;
        });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
      });
      const result = await rpcCall(address, 'agent.claudeHook', {
        action,
        rawInput,
        terminalKey: terminalKey || undefined,
        cwd: parsed.flags['cwd'] ?? process.env['VMUX_CWD'],
      });
      printResult(result, json);
      break;
    }

    case 'codex-hook': {
      const rawArg = parsed.positional[0];
      const rawInput = rawArg ?? await new Promise<string>((resolve, reject) => {
        if (process.stdin.isTTY) {
          resolve('');
          return;
        }
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => {
          data += chunk;
        });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
      });
      const result = await rpcCall(address, 'agent.codexHook', {
        rawInput,
        terminalKey: terminalKey || undefined,
      });
      await runChainedCodexNotify(rawInput);
      printResult(result, json);
      break;
    }

    case 'agent-hook': {
      const agent = parsed.positional[0];
      const action = parsed.positional[1];
      if (!agent || !action) throw new Error('<agent> and <action> arguments are required');
      const exitCode = parsed.flags['exit-code'];
      const result = await rpcCall(address, 'agent.lifecycle', {
        agent,
        action,
        terminalKey: terminalKey || undefined,
        cwd: parsed.flags['cwd'] ?? process.env['VMUX_CWD'],
        exitCode: exitCode !== undefined ? parseInt(exitCode, 10) : undefined,
      });
      printResult(result, json);
      break;
    }

    // ── Agent Grid ──
    case 'launch-grid': {
      const name = parsed.flags['name'] ?? 'grid';
      const rows = parseInt(parsed.flags['rows'] ?? '2', 10);
      const cols = parseInt(parsed.flags['cols'] ?? '2', 10);
      const result = await rpcCall(address, 'agent.grid', {
        name, rows, cols, cwd: parsed.flags['cwd'],
      });
      printResult(result, json);
      break;
    }
    case 'broadcast': {
      const grid = parsed.flags['grid'];
      const text = parsed.positional[0];
      if (!grid) throw new Error('--grid is required');
      if (!text) throw new Error('<text> argument is required');
      const result = await rpcCall(address, 'agent.broadcast', { grid, text });
      printResult(result, json);
      break;
    }
    case 'list-grids': {
      const result = await rpcCall(address, 'agent.grids', {});
      printResult(result, json);
      break;
    }

    // ── Agent Presets ──
    case 'save-agent': {
      const name = parsed.flags['name'];
      if (!name) throw new Error('--name is required');
      const result = await rpcCall(address, 'agent.preset.save', {
        name,
        command: parsed.flags['command'],
        cwd: parsed.flags['cwd'],
        shellPath: parsed.flags['shell'],
      });
      printResult(result, json);
      break;
    }
    case 'list-agents': {
      const result = await rpcCall(address, 'agent.preset.list', {});
      printResult(result, json);
      break;
    }
    case 'launch-agent': {
      const name = parsed.flags['name'];
      if (!name) throw new Error('--name is required');
      const result = await rpcCall(address, 'agent.preset.launch', { name });
      printResult(result, json);
      break;
    }

    // ── Tab Groups ──
    case 'create-tabgroup': {
      const name = parsed.flags['name'];
      if (!name) throw new Error('--name is required');
      const result = await rpcCall(address, 'tabgroup.create', {
        name,
        color: parsed.flags['color'],
      });
      printResult(result, json);
      break;
    }
    case 'delete-tabgroup': {
      const name = parsed.flags['name'];
      if (!name) throw new Error('--name is required');
      const result = await rpcCall(address, 'tabgroup.delete', { name });
      printResult(result, json);
      break;
    }
    case 'rename-tabgroup': {
      const oldName = parsed.flags['name'];
      const newName = parsed.flags['new-name'];
      if (!oldName || !newName) throw new Error('--name and --new-name are required');
      const result = await rpcCall(address, 'tabgroup.rename', { oldName, newName });
      printResult(result, json);
      break;
    }
    case 'list-tabgroups': {
      const result = await rpcCall(address, 'tabgroup.list', {});
      printResult(result, json);
      break;
    }
    case 'add-to-tabgroup': {
      const group = parsed.flags['group'];
      const terminal = parsed.flags['terminal'];
      if (!group || !terminal) throw new Error('--group and --terminal are required');
      const result = await rpcCall(address, 'tabgroup.addTerminal', { group, terminal });
      printResult(result, json);
      break;
    }
    case 'remove-from-tabgroup': {
      const group = parsed.flags['group'];
      const terminal = parsed.flags['terminal'];
      if (!group || !terminal) throw new Error('--group and --terminal are required');
      const result = await rpcCall(address, 'tabgroup.removeTerminal', { group, terminal });
      printResult(result, json);
      break;
    }
    case 'broadcast-tabgroup': {
      const group = parsed.flags['group'];
      const text = parsed.positional[0];
      if (!group) throw new Error('--group is required');
      if (!text) throw new Error('<text> argument is required');
      const result = await rpcCall(address, 'tabgroup.broadcast', { group, text });
      printResult(result, json);
      break;
    }

    case '--help':
    case 'help':
    case '':
      printUsage();
      break;

    default:
      process.stderr.write(`Unknown command: ${parsed.command}\n`);
      printUsage();
      process.exit(1);
  }
}

function printUsage(): void {
  process.stdout.write(`Usage: vmux <command> [options]

Notifications:
  ping
  notify --title <t> [--body <b>] [--level info|warning|error]
  list-notifications [--json]
  clear-notifications [--id <id>] [--terminal <id>]

Terminals:
  create-terminal --name <n> [--cwd <path>] [--shell <path>]
  list-terminals [--json]
  send --terminal <name> <text>
  focus --terminal <name>
  close --terminal <name>

Sessions:
  save-session --name <n>
  restore-session --name <n>
  list-sessions [--json]

Metadata:
  set-status <key> <value> [--icon <name>] [--color <hex>] [--terminal <id>]
  set-progress <value> [--label <text>] [--terminal <id>]
  log <message> [--level info|progress|success|warning|error] [--terminal <id>]

Claude:
  claude-hook <session-start|notification|prompt-submit|stop|session-end|pre-tool-use> [--terminal <id>] [--cwd <path>]
  codex-hook [payload-json]
  agent-hook <codex|gemini> <start|stop> [--terminal <id>] [--cwd <path>] [--exit-code <n>]

Agent Grid:
  launch-grid [--name <n>] [--rows <r>] [--cols <c>] [--cwd <path>]
  broadcast --grid <name> <text>
  list-grids [--json]

Agent Presets:
  save-agent --name <n> [--command <cmd>] [--cwd <path>] [--shell <path>]
  list-agents [--json]
  launch-agent --name <n>

Tab Groups:
  create-tabgroup --name <n> [--color <color>]
  delete-tabgroup --name <n>
  rename-tabgroup --name <n> --new-name <new>
  list-tabgroups [--json]
  add-to-tabgroup --group <g> --terminal <t>
  remove-from-tabgroup --group <g> --terminal <t>
  broadcast-tabgroup --group <g> <text>

Options:
  --socket <path>   IPC socket path or HTTP URL
  --json            Output as JSON
  --help            Show this help
`);
}

// ─── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const parsed = parseArgv(process.argv);

  if (parsed.command === '--help' || parsed.command === 'help' || parsed.command === '') {
    printUsage();
    return;
  }

  const address = discoverSocket(parsed.flags);
  await runCommand(address, parsed);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
