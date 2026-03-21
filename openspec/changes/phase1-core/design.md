## Context

vmux is a VS Code terminal extension for AI coding agents. Today, agents have no standard way to notify the user, restore sessions, or understand their execution context while running in the VS Code terminal.

cmux, a native macOS app, addresses this problem but is platform-limited. Phase 1 builds the extension foundation (IPC + CLI) and the three core capabilities (notifications, sessions, and environment variables).

**Constraints:**
- VS Code 1.99+ (based on Shell Integration API stabilization)
- Proposed APIs cannot be used in Marketplace extensions (`onDidWriteTerminalData` and similar are excluded)
- Existing terminal buffers cannot be read (`TerminalBuffer` remains backlogged)

## Goals / Non-Goals

**Goals:**
- Let agents send notifications to VS Code with a single CLI command
- Save and restore terminal sessions (name, CWD, splits, environment variables)
- Let agents understand their execution context through environment variables
- Support macOS, Linux, and Windows
- Keep agent hook setup under 5 minutes

**Non-Goals:**
- Phase 2 and 3 features (metadata panel, activity monitor, multi-agent orchestration, MCP server)
- GPU terminal rendering (use VS Code's built-in xterm.js)
- Capturing existing terminal output (depends on proposed APIs)
- 100% cmux CLI compatibility (`vmux` prefix only in Phase 1)

## Decisions

### D1. Extension structure — Monorepo (extension + CLI)

Manage the extension and CLI together in a single repository.

```text
src/
├── extension/          # VS Code Extension Host code
│   ├── extension.ts    # activate/deactivate entry point
│   ├── ipc/            # IPC server (Unix socket + HTTP)
│   ├── notifications/  # notification manager + TreeView
│   ├── sessions/       # session manager + TreeView
│   ├── terminals/      # terminal manager + env injection
│   └── views/          # TreeDataProvider implementations
├── cli/                # vmux CLI
│   └── index.ts        # single entry point
└── shared/             # shared types + JSON-RPC protocol definitions
    ├── protocol.ts     # JSON-RPC method and parameter types
    └── types.ts        # Notification, Session, Terminal types
```

**Build:**
- Extension: esbuild → `dist/extension.js` (Node.js, CJS)
- CLI: esbuild → `dist/cli.js` (Node.js, CJS, `#!/usr/bin/env node` shebang)

**Alternative:** split into separate repositories. Rejected because protocol synchronization overhead is unnecessary and a single package is easier to manage.

### D2. IPC protocol — JSON-RPC 2.0 over Unix socket + HTTP fallback

**Unix socket (default on macOS/Linux):**
- Socket path: `${XDG_RUNTIME_DIR:-/tmp}/vmux-${workspaceHash}.sock`
- `workspaceHash`: first 8 characters of the SHA-256 hash of the workspace URI (prevents multi-window collisions)
- File mode `0600` (owner access only)

**HTTP fallback (Windows or configuration override):**
- `http://127.0.0.1:{PORT}` (`PORT` is an OS-assigned ephemeral port)
- Inject the port into `VMUX_SOCKET` as `http://127.0.0.1:{PORT}`

**Protocol:** JSON-RPC 2.0 (no batch support), one request/response pair at a time.

```typescript
// Phase 1 methods
type Methods = {
  'notification.create': { title: string; body?: string; level?: 'info' | 'warning' | 'error'; terminalId?: string }
  'notification.list': {}
  'notification.clear': { id?: string }  // clear all if id is omitted
  'terminal.create': { name: string; cwd?: string; env?: Record<string, string>; shellPath?: string }
  'terminal.list': {}
  'terminal.focus': { name: string }
  'terminal.close': { name: string }
  'terminal.send': { name: string; text: string }
  'session.save': { name: string }
  'session.restore': { name: string }
  'session.list': {}
}
```

**Alternatives:**
- gRPC → increases CLI complexity with a binary protocol; JSON-RPC can also be tested with `curl`
- WebSocket → unnecessary because Phase 1 only needs request/response semantics

### D3. CLI design — single-file, zero-dependency

Bundle the CLI as a single Node.js file. Use only the built-in `net` and `http` modules.

```bash
vmux notify --title "Done" --body "Task complete" --level info
vmux list-notifications --json
vmux clear-notifications
vmux create-terminal --name "agent-1" --cwd /project
vmux list-terminals --json
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
vmux list-sessions --json
```

**Socket discovery order:**
1. `VMUX_SOCKET` environment variable (injected by the extension)
2. `--socket` CLI option
3. `/tmp/vmux-*.sock` glob → most recently modified socket

**Distribution:** bundle as `bin/vmux` inside the extension and also support npm global install (`package.json` `bin` field)

**Alternative:** Python or Rust CLI. Rejected because Node.js can share types with the extension and does not add another runtime.

### D4. Notification system — in-memory + TreeDataProvider

Store notifications in Extension Host memory for the lifetime of the workspace. Persistence is unnecessary.

```typescript
interface Notification {
  id: string           // nanoid
  title: string
  body?: string
  level: 'info' | 'warning' | 'error'
  terminalId?: string  // linked terminal
  timestamp: number    // Date.now()
  read: boolean
}
```

**UI structure:**
- `StatusBarItem`: unread notification badge; clicking focuses the Notifications TreeView
- `TreeDataProvider<Notification>`: time-ordered list with icons based on level
- Clicking a notification focuses the linked `terminalId`
- `Cmd+Shift+U` jumps to the latest unread notification
- System notifications: `vscode.window.showInformationMessage()` with configuration on/off

**Alternative:** persistent storage (`globalState`). Rejected because notifications are ephemeral and resetting them on restart is reasonable.

### D5. Session management — JSON file + workspace storage

**Session preset format:**
```typescript
interface SessionPreset {
  name: string
  terminals: {
    name: string
    cwd?: string
    shellPath?: string
    env?: Record<string, string>
    group?: number  // identical group numbers become split terminals
  }[]
}
```

**Storage locations:**
- `.vscode/vmux-sessions.json`: project-level presets that can be shared via git
- Workspace storage: auto-saved current terminal state for auto-restore

**Restore process:**
1. Call `vscode.window.createTerminal({ name, cwd, env, shellPath })` sequentially
2. Create split groups for terminals with the same `group` number through `TerminalLocation.Panel`
3. Auto-restore the last state when `vmux.autoRestore: true` is enabled

**Limitation:** scrollback buffers cannot be restored due to VS Code API limits. Only CWD, name, and environment variables are restored.

**Alternative:** store sessions in `settings.json`. Rejected because session data is cleaner when separated from VS Code settings.

### D6. Environment variable injection — `TerminalOptions.env` + `TerminalProfileProvider`

Automatically inject `VMUX_*` environment variables into all managed terminals.

```typescript
const env = {
  VMUX_TERMINAL_ID: uniqueId,
  VMUX_WORKSPACE: vscode.workspace.name ?? '',
  VMUX_SESSION: currentSessionName ?? '',
  VMUX_SOCKET: socketPath,  // Unix socket path or http://... URL
  VMUX_CWD: cwd,
}
```

**Injection paths:**
1. Register a `TerminalProfileProvider` and add env vars to the default profile
2. Always include env vars in `createTerminal()` calls
3. Track user-opened terminals with `vscode.window.onDidOpenTerminal` (env injection is API-limited and only possible through `TerminalProfileProvider`)

**Alternative:** inject `export` commands through `shellArgs`. Rejected because it requires shell-specific branching and the env option is cleaner.

### D7. Build system — esbuild + npm scripts

```json
{
  "scripts": {
    "build": "npm run build:ext && npm run build:cli",
    "build:ext": "esbuild src/extension/extension.ts --bundle --outfile=dist/extension.js --platform=node --format=cjs --external:vscode",
    "build:cli": "esbuild src/cli/index.ts --bundle --outfile=dist/cli.js --platform=node --format=cjs --banner:js='#!/usr/bin/env node'",
    "watch": "npm run build:ext -- --watch & npm run build:cli -- --watch",
    "test": "node --test dist/test/**/*.test.js",
    "lint": "eslint src/",
    "package": "vsce package"
  }
}
```

**Testing:**
- Unit tests: built-in Node.js test runner (`node --test`)
- Integration tests: `@vscode/test-electron` (Extension Host environment)
- IPC tests: real socket and HTTP connection tests

## Risks / Trade-offs

**[Stale Unix socket file]** → delete the socket file during extension deactivation and automatically clean stale sockets when the CLI fails to connect

**[Multi-window VS Code conflicts]** → separate socket paths with `workspaceHash`. If the same workspace is opened in a second window, the second window takes over the existing socket

**[CLI socket discovery failure]** → prioritize `VMUX_SOCKET`, fall back to glob + mtime search, and return a clear error message on failure

**[No Unix sockets on Windows]** → use the HTTP fallback. Commands stay the same and the localhost performance cost is negligible

**[Imperfect split-group restore]** → VS Code can create terminals in the Panel via the `location` option, but exact split placement control is limited. Restore remains best-effort

**[TerminalProfileProvider limitation]** → users must choose the vmux profile instead of a custom default profile to receive injected env vars. Register the vmux profile as the default entry point to reduce friction
