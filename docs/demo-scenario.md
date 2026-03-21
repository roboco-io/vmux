# vmux MCP Demo Scenario

This document contains demo scenarios that Claude Code can execute by using the vmux MCP tools.

> **Prerequisite**: the vmux extension must be installed and active in VS Code, the vmux MCP server must be configured in `.mcp.json`, and `VMUX_SOCKET` must be connected.

---

## Scenario 1: Simulated Agent Workflow

Simulate a full AI agent workflow: code analysis → build → test → deploy.

### Steps

1. **Notification**: `create_notification(title="Agent", body="Starting work", level="info")`
2. **Create terminal**: `create_terminal(name="agent-worker", cwd="/tmp")`
3. **Set status**: `set_status(terminalId="agent-worker", key="state", value="running", icon="play")`
4. **Progress 0%**: `set_progress(terminalId="agent-worker", value=0, label="Analyzing code...")`
5. **Run command**: `send_command(name="agent-worker", text="echo 'Analyzing 42 files...'")`
6. **Progress 25%**: `set_progress(terminalId="agent-worker", value=0.25, label="Building...")`
7. **Run command**: `send_command(name="agent-worker", text="echo 'Build successful'")`
8. **Progress 50%**: `set_progress(terminalId="agent-worker", value=0.5, label="Running tests...")`
9. **Run command**: `send_command(name="agent-worker", text="echo '24/24 tests passed'")`
10. **Progress 75%**: `set_progress(terminalId="agent-worker", value=0.75, label="Deploying...")`
11. **Run command**: `send_command(name="agent-worker", text="echo 'Deployed to staging'")`
12. **Progress 100%**: `set_progress(terminalId="agent-worker", value=1, label="Done")`
13. **Complete status**: `set_status(terminalId="agent-worker", key="state", value="done", icon="check")`
14. **Completion notification**: `create_notification(title="Agent", body="All tasks are complete", level="info")`

### Verification Points

- The Metadata TreeView updates the progress bar from 0% → 25% → 50% → 75% → 100%
- The spinner icon changes to a checkmark at 100%
- A notification badge appears in the Status Bar
- The terminal shows the `echo` output

### Cleanup

- `close_terminal(name="agent-worker")`
- `clear_notifications()`

---

## Scenario 2: Error Handling

Simulate an agent reporting a build failure.

### Steps

1. **Create terminal**: `create_terminal(name="build-agent")`
2. **Set status**: `set_status(terminalId="build-agent", key="build", value="running", icon="loading~spin")`
3. **Progress 30%**: `set_progress(terminalId="build-agent", value=0.3, label="Compiling...")`
4. **Run command**: `send_command(name="build-agent", text="echo 'ERROR: Cannot find module ./missing'")`
5. **Fail status**: `set_status(terminalId="build-agent", key="build", value="FAILED", icon="error")`
6. **Error notification**: `create_notification(title="Build Failed", body="Cannot find module ./missing", level="error")`
7. **Warning notification**: `create_notification(title="CI Pipeline", body="Deployment stopped because the build failed", level="warning")`

### Verification Points

- The Metadata TreeView shows the build state with an error icon
- A VS Code popup displays the error message
- The Notifications TreeView shows both error and warning notifications

### Cleanup

- `close_terminal(name="build-agent")`
- `clear_notifications()`

---

## Scenario 3: Multi-Terminal Management

Create multiple terminals and save or restore them as a session.

### Steps

1. **Create three terminals**:
   - `create_terminal(name="frontend", cwd="/tmp")`
   - `create_terminal(name="backend", cwd="/tmp")`
   - `create_terminal(name="database", cwd="/tmp")`
2. **Send commands to each terminal**:
   - `send_command(name="frontend", text="echo 'React dev server started on :3000'")`
   - `send_command(name="backend", text="echo 'API server started on :8080'")`
   - `send_command(name="database", text="echo 'PostgreSQL connected on :5432'")`
3. **Set terminal status values**:
   - `set_status(terminalId="frontend", key="port", value=":3000", icon="globe")`
   - `set_status(terminalId="backend", key="port", value=":8080", icon="server")`
   - `set_status(terminalId="database", key="port", value=":5432", icon="database")`
4. **List terminals**: `list_terminals()`
5. **Move focus**: `focus_terminal(name="backend")`
6. **Notification**: `create_notification(title="Dev Environment", body="3 services are running", level="info")`

### Verification Points

- The Terminals TreeView shows three terminals
- The Metadata TreeView shows a status pill for each terminal
- Focus changes to the selected terminal

### Cleanup

- `close_terminal(name="frontend")`
- `close_terminal(name="backend")`
- `close_terminal(name="database")`
- `clear_notifications()`

---

## Scenario 4: Notification Priority

Send notifications at different levels and verify how they appear in the TreeView.

### Steps

1. `create_notification(title="Info", body="General information message", level="info")`
2. `create_notification(title="Warning", body="Disk usage at 85%", level="warning")`
3. `create_notification(title="Error", body="Database connection failed", level="error")`
4. `create_notification(title="Info", body="Backup complete", level="info")`
5. `create_notification(title="Error", body="Out of memory", level="error")`
6. **List notifications**: `list_notifications()`

### Verification Points

- The Notifications TreeView shows five notifications in reverse chronological order
- Each notification has the correct icon for its level (`info` / `warning` / `error`)
- The Status Bar badge shows `5`
- `Cmd+Shift+U` jumps to the latest notification

### Cleanup

- `clear_notifications()`
