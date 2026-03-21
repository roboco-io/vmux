## ADDED Requirements

### Requirement: IPC server startup and shutdown

The IPC server SHALL start automatically when the extension activates, and it SHALL be cleaned up when the extension deactivates.

#### Scenario: Start the Unix socket server on activation (macOS/Linux)
- **WHEN** the VS Code extension activates, the OS is macOS or Linux, and `vmux.ipc.type` is `unix`
- **THEN** a Unix socket server SHALL be created at `${XDG_RUNTIME_DIR:-/tmp}/vmux-${workspaceHash}.sock`
- **THEN** the socket file permissions SHALL be `0600`

#### Scenario: Start the HTTP server on activation (Windows or configuration)
- **WHEN** the OS is Windows or `vmux.ipc.type` is `http`
- **THEN** an HTTP server SHALL start on `http://127.0.0.1` with an ephemeral port
- **THEN** it MUST NOT bind to an external interface

#### Scenario: Cleanup on deactivation
- **WHEN** the extension deactivates
- **THEN** the IPC server SHALL stop
- **THEN** the Unix socket file SHALL be deleted

#### Scenario: Handle a stale socket file
- **WHEN** a file already exists at the socket path during activation and the extension cannot connect to it
- **THEN** the old socket file SHALL be deleted and a new server SHALL start

### Requirement: JSON-RPC 2.0 protocol support

The IPC server SHALL process JSON-RPC 2.0 requests.

#### Scenario: Process a valid JSON-RPC request
- **WHEN** a valid JSON-RPC 2.0 request is received
- **THEN** the server SHALL execute the requested method and return a JSON-RPC 2.0 response

#### Scenario: Call an unknown method
- **WHEN** a request is received for an unregistered method name
- **THEN** the server SHALL return JSON-RPC error code `-32601` (`Method not found`)

#### Scenario: Parse invalid JSON
- **WHEN** data is received that cannot be parsed as JSON
- **THEN** the server SHALL return JSON-RPC error code `-32700` (`Parse error`)

#### Scenario: Invalid parameters
- **WHEN** required parameters are missing or parameter types are invalid for a method
- **THEN** the server SHALL return JSON-RPC error code `-32602` (`Invalid params`)

### Requirement: Multi-window isolation

The IPC server SHALL avoid conflicts when multiple VS Code windows are open on the same machine.

#### Scenario: Different workspaces
- **WHEN** two VS Code windows open different workspaces
- **THEN** each window SHALL run its own server with a separate socket path derived from `workspaceHash`

#### Scenario: Open the same workspace in a second window
- **WHEN** a second VS Code window opens a workspace whose socket is already in use
- **THEN** the system SHALL either take over the existing socket connection or warn the user
