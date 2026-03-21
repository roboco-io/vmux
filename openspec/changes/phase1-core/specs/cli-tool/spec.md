## ADDED Requirements

### Requirement: CLI socket auto-discovery

The CLI SHALL automatically discover the IPC server socket.

#### Scenario: Discover the socket from an environment variable
- **WHEN** the `VMUX_SOCKET` environment variable is set
- **THEN** the CLI SHALL use its value as the socket path or HTTP URL

#### Scenario: Set the socket with a CLI option
- **WHEN** the `--socket` option is provided
- **THEN** the CLI SHALL use that value as the socket path and it SHALL take precedence over the environment variable

#### Scenario: Glob-based automatic search
- **WHEN** neither the environment variable nor the `--socket` option is present
- **THEN** the CLI SHALL use the most recently modified socket file that matches `/tmp/vmux-*.sock`

#### Scenario: Socket not found
- **WHEN** the CLI cannot find a socket through any discovery path
- **THEN** it SHALL exit with code `1` and a clear error message

### Requirement: Notification CLI commands

The CLI SHALL support notification-related commands.

#### Scenario: Create a notification
- **WHEN** `vmux notify --title "Title" --body "Body" --level error` is executed
- **THEN** the CLI SHALL send a `notification.create` JSON-RPC request to the IPC server
- **THEN** the default value for `--level` SHALL be `info`

#### Scenario: List notifications
- **WHEN** `vmux list-notifications --json` is executed
- **THEN** the CLI SHALL send a `notification.list` request to the IPC server and print the result as JSON

#### Scenario: Clear notifications
- **WHEN** `vmux clear-notifications` is executed
- **THEN** the CLI SHALL send a `notification.clear` request to the IPC server

### Requirement: Terminal control CLI commands

The CLI SHALL support terminal control commands.

#### Scenario: Create a terminal
- **WHEN** `vmux create-terminal --name "agent-1" --cwd /project` is executed
- **THEN** the CLI SHALL send a `terminal.create` request to the IPC server

#### Scenario: List terminals
- **WHEN** `vmux list-terminals --json` is executed
- **THEN** the CLI SHALL send a `terminal.list` request to the IPC server and print the result as JSON

#### Scenario: Send a command to a terminal
- **WHEN** `vmux send --terminal "agent-1" "npm test"` is executed
- **THEN** the CLI SHALL send a `terminal.send` request to the IPC server

#### Scenario: Focus a terminal
- **WHEN** `vmux focus --terminal "agent-1"` is executed
- **THEN** the CLI SHALL send a `terminal.focus` request to the IPC server

#### Scenario: Close a terminal
- **WHEN** `vmux close --terminal "agent-1"` is executed
- **THEN** the CLI SHALL send a `terminal.close` request to the IPC server

### Requirement: Session CLI commands

The CLI SHALL support session management commands.

#### Scenario: Save a session
- **WHEN** `vmux save-session --name "dev-setup"` is executed
- **THEN** the CLI SHALL send a `session.save` request to the IPC server

#### Scenario: Restore a session
- **WHEN** `vmux restore-session --name "dev-setup"` is executed
- **THEN** the CLI SHALL send a `session.restore` request to the IPC server

#### Scenario: List sessions
- **WHEN** `vmux list-sessions --json` is executed
- **THEN** the CLI SHALL send a `session.list` request to the IPC server and print the result as JSON

### Requirement: Zero-dependency single binary

The CLI SHALL be bundled into a single file that uses only built-in Node.js modules and no external npm dependencies.

#### Scenario: Run the bundled CLI
- **WHEN** `node dist/cli.js notify --title "test"` is executed
- **THEN** it SHALL work without any additional `npm install`

#### Scenario: Execute directly with a shebang
- **WHEN** `chmod +x dist/cli.js && ./dist/cli.js --help` is executed
- **THEN** it SHALL run directly through the `#!/usr/bin/env node` shebang
