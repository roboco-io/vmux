## Why

AI coding agents such as Claude Code, Codex, and Gemini CLI currently have no standard way to send notifications, manage sessions, or understand their execution context when running in a VS Code terminal. cmux, a native macOS app, addresses this problem, but it is macOS-only and separate from the VS Code workflow. By implementing the core capabilities as a VS Code extension, vmux provides a cross-platform, agent-friendly terminal environment.

## What Changes

- Scaffold the VS Code extension project (TypeScript + esbuild)
- Implement an IPC server (Unix socket by default + HTTP fallback, JSON-RPC 2.0 protocol)
- Implement the `vmux` CLI tool (single-file Node.js IPC client)
- Add the Agent Notification System: CLI → IPC → StatusBar badge + TreeView panel + system notifications
- Add Terminal Session Management: save and restore workspace-specific terminal layout presets
- Add Environment Context Injection: automatically inject `VMUX_*` environment variables
- Add a vmux sidebar view container to the Activity Bar (Notifications, Terminals, Sessions TreeViews)

## Capabilities

### New Capabilities
- `ipc-server`: JSON-RPC 2.0-based IPC server. Unix sockets on macOS/Linux plus HTTP as the Windows fallback. Communication channel between the CLI or external tools and the extension
- `cli-tool`: `vmux` CLI binary. Sends JSON-RPC requests to the IPC server and supports notification, terminal control, and session commands
- `agent-notifications`: agent notification system. Creates, lists, and clears notifications, updates the StatusBar badge, renders the Notifications TreeView, focuses terminals from notifications, and integrates system notifications
- `terminal-sessions`: terminal session management. Creates named terminals, saves and restores layout presets, stores settings in `.vscode/vmux-sessions.json`, and supports auto-restore
- `env-context`: environment context injection. Automatically sets `VMUX_TERMINAL_ID`, `_WORKSPACE`, `_SESSION`, `_SOCKET`, and `_CWD`, and integrates with `TerminalProfileProvider`

### Modified Capabilities

## Impact

- **New code**: the entire VS Code extension (TypeScript) and CLI tool (Node.js)
- **VS Code API dependencies**: `vscode.window.createTerminal`, `StatusBarItem`, `TreeDataProvider`, `TerminalProfileProvider`, Shell Integration API
- **Runtime dependencies**: Node.js `net` (Unix socket) and `http`
- **Build dependencies**: esbuild, TypeScript, `@vscode/test-electron`, mocha
- **Filesystem**: `.vscode/vmux-sessions.json` (session presets), workspace storage (notification state)
- **Network**: localhost only (Unix socket or HTTP, no external exposure)
- **Platforms**: macOS/Linux (Unix socket), Windows (HTTP fallback)
