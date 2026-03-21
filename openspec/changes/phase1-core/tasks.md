## 1. Project Scaffolding

- [x] 1.1 Create `package.json` with `npm init` and add TypeScript, esbuild, eslint, and prettier dependencies
- [x] 1.2 Configure `tsconfig.json` (strict mode, Node.js + VS Code types)
- [x] 1.3 Configure esbuild scripts (extension + CLI dual bundle, watch mode)
- [x] 1.4 Write the VS Code extension manifest (`contributes`: viewsContainers, views, commands, keybindings, configuration)
- [x] 1.5 Create the directory structure: `src/extension/`, `src/cli/`, `src/shared/`, `src/test/`
- [x] 1.6 Configure `.vscodeignore` and `.gitignore`
- [x] 1.7 Add the extension entry point (`extension.ts`) skeleton: `activate` / `deactivate`

## 2. Shared Protocol & Types

- [x] 2.1 Write `src/shared/types.ts`: `Notification`, `SessionPreset`, and `TerminalInfo` interfaces
- [x] 2.2 Write `src/shared/protocol.ts`: JSON-RPC 2.0 request and response types plus per-method parameter and result types
- [x] 2.3 Add JSON-RPC utility functions: `createRequest`, `createResponse`, `createError`, `parseMessage`

## 3. IPC Server

- [x] 3.1 `src/extension/ipc/server.ts`: abstract `IpcServer` interface (`start`, `stop`, `onRequest`)
- [x] 3.2 `src/extension/ipc/unix-socket-server.ts`: implement a Unix socket server with Node.js `net`
- [x] 3.3 `src/extension/ipc/http-server.ts`: implement an HTTP server with Node.js `http`
- [x] 3.4 Implement socket path generation: `workspaceHash` (first 8 chars of SHA-256) + `XDG_RUNTIME_DIR` fallback
- [x] 3.5 Implement stale socket file detection and cleanup
- [x] 3.6 Implement a JSON-RPC method router: map method names to handlers and handle error codes (`-32601`, `-32700`, `-32602`)
- [x] 3.7 Auto-select by platform: macOS/Linux → Unix socket, Windows → HTTP
- [x] 3.8 Wire IPC server startup and shutdown into `extension.ts` (`activate` / `deactivate`)
- [x] 3.9 Add IPC server unit tests: request parsing, error responses, socket creation and cleanup

## 4. CLI Tool

- [x] 4.1 `src/cli/index.ts`: argument parser based on built-in `process.argv` only
- [x] 4.2 Implement socket discovery order: `VMUX_SOCKET` → `--socket` option → `/tmp` glob
- [x] 4.3 Implement a JSON-RPC client over Unix socket (`net`) + HTTP (`http`)
- [x] 4.4 Implement the `notify` command: parse `--title`, `--body`, `--level` and send `notification.create`
- [x] 4.5 Implement `list-notifications` and `clear-notifications`
- [x] 4.6 Implement `create-terminal`, `list-terminals`, `send`, `focus`, and `close`
- [x] 4.7 Implement `save-session`, `restore-session`, and `list-sessions`
- [x] 4.8 Implement `--json` output formatting and `--help`
- [x] 4.9 Add error handling for socket connection failures, timeouts, and JSON-RPC errors with user-friendly messages
- [x] 4.10 Verify single-file bundling with esbuild and shebang insertion
- [x] 4.11 Add CLI integration tests against a real socket connection

## 5. Agent Notifications

- [x] 5.1 `src/extension/notifications/manager.ts`: `NotificationManager` (create, list, delete, mark read)
- [x] 5.2 In-memory notification store: `Map<id, Notification>` sorted by reverse timestamp
- [x] 5.3 Register IPC handlers: `notification.create`, `notification.list`, `notification.clear`
- [x] 5.4 `src/extension/views/notifications-tree.ts`: implement `NotificationsTreeDataProvider`
- [x] 5.5 TreeView items: level icons (`info` / `warning` / `error`), title, timestamp, read-state styling
- [x] 5.6 Clicking a notification focuses the terminal and marks it as read
- [x] 5.7 `StatusBarItem`: unread notification badge, bell icon, click to focus the TreeView
- [x] 5.8 `vmux.jumpToNotification` command: focus the latest unread notification terminal
- [x] 5.9 Register keybindings: `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` (Windows/Linux)
- [x] 5.10 System notifications: call `showInformationMessage` / `showWarningMessage` / `showErrorMessage` based on `vmux.systemNotifications`
- [x] 5.11 Add notification system unit tests: create, list, delete, mark read, StatusBar updates

## 6. Terminal Sessions

- [x] 6.1 `src/extension/sessions/manager.ts`: `SessionManager` (save, restore, list, delete)
- [x] 6.2 Implement session preset file I/O for `.vscode/vmux-sessions.json`
- [x] 6.3 Capture current terminal state: name, CWD when available, shell path
- [x] 6.4 Restore sessions with sequential `createTerminal` calls and split groups based on group number
- [x] 6.5 Register IPC handlers: `session.save`, `session.restore`, `session.list`
- [x] 6.6 `src/extension/views/sessions-tree.ts`: implement `SessionsTreeDataProvider`
- [x] 6.7 TreeView items: session names, nested terminal list, inline restore and delete buttons
- [x] 6.8 Command Palette commands: `vmux.saveSession` (name input prompt), `vmux.restoreSession` (QuickPick)
- [x] 6.9 Auto-restore the last saved state when `vmux.autoRestore` is enabled
- [x] 6.10 Add session management unit tests: save, restore, list, delete, file I/O

## 7. Environment Context & Terminal Management

- [x] 7.1 `src/extension/terminals/manager.ts`: `TerminalManager` (create, list, focus, close, send)
- [x] 7.2 Environment variable builder: honor `vmux.envPrefix` and generate `VMUX_*` variables
- [x] 7.3 Register a `TerminalProfileProvider`: `"vmux"` profile using the default shell + env injection
- [x] 7.4 Register IPC handlers: `terminal.create`, `terminal.list`, `terminal.focus`, `terminal.close`, `terminal.send`
- [x] 7.5 `src/extension/views/terminals-tree.ts`: implement `TerminalsTreeDataProvider`
- [x] 7.6 TreeView items: terminal name, CWD, active/closed state, click to focus
- [x] 7.7 Track terminal lifecycle with `onDidOpenTerminal` and `onDidCloseTerminal`
- [x] 7.8 Add terminal management unit tests: create, list, focus, close, env injection verification

## 8. Integration & E2E Testing

- [x] 8.1 Configure `@vscode/test-electron` for Extension Host tests
- [x] 8.2 E2E scenario: CLI notify → TreeView verification → terminal focus
- [x] 8.3 E2E scenario: save session → restore session → verify terminal state
- [x] 8.4 E2E scenario: verify environment variable injection (create terminal → inspect env)
- [x] 8.5 Cross-platform verification: Unix socket + HTTP fallback

## 9. Documentation & Polish

- [x] 9.1 Write agent hook examples for Claude Code, Codex, and Gemini CLI
- [x] 9.2 Write the initial `CHANGELOG.md`
- [x] 9.3 Create the extension icon (`resources/vmux-icon.svg`)
- [x] 9.4 Verify `.vsix` package build with `vsce package`
