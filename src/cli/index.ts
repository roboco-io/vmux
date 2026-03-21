import * as net from 'node:net';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createRequest } from '../shared/protocol.js';

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

  // 2. VSCODE_CMUX_SOCKET env
  const envSocket = process.env['VSCODE_CMUX_SOCKET'];
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
    'Set VSCODE_CMUX_SOCKET or use --socket <path>.'
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

  switch (parsed.command) {
    // ── Notifications ──
    case 'notify': {
      const title = parsed.flags['title'];
      if (!title) throw new Error('--title is required');
      const result = await rpcCall(address, 'notification.create', {
        title,
        body: parsed.flags['body'],
        level: parsed.flags['level'] ?? 'info',
        terminalId: parsed.flags['terminal-id'],
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
      const terminalId = parsed.flags['terminal'] ?? process.env['VMUX_TERMINAL_ID'] ?? '';
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
      const terminalId = parsed.flags['terminal'] ?? process.env['VMUX_TERMINAL_ID'] ?? '';
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
      const terminalId = parsed.flags['terminal'] ?? process.env['VMUX_TERMINAL_ID'] ?? '';
      if (!message) throw new Error('<message> argument is required');
      const result = await rpcCall(address, 'metadata.log', {
        terminalId, message,
        level: parsed.flags['level'] ?? 'info',
      });
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
  notify --title <t> [--body <b>] [--level info|warning|error]
  list-notifications [--json]
  clear-notifications [--id <id>]

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
