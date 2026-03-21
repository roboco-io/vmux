# vmux — Agent-Friendly Terminal Extension for VS Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/roboco-io.vmux)](https://marketplace.visualstudio.com/items?itemName=roboco-io.vmux)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md)

VS Code terminal extension for AI coding agents such as Claude Code, Codex, and Gemini CLI.
Agents can send notifications, manage sessions, display metadata, and orchestrate multi-terminal workflows — all from the terminal.

> Inspired by [cmux](https://github.com/manaflow-ai/cmux), a native agent terminal for macOS.

## Install

```bash
# From VS Code Marketplace
code --install-extension roboco-io.vmux

# Or search "vmux" in the VS Code Extensions panel
```

## Features

### Notifications
Send notifications from agents to VS Code — Status Bar badge, sidebar TreeView, and system popups.

```bash
vmux notify --title "Claude Code" --body "Task complete"
vmux notify --title "Build" --body "Failed" --level error
```

### Terminal Control
Create, focus, send commands to, and close terminals programmatically.

```bash
vmux create-terminal --name "agent-1" --cwd /project
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"
```

### Session Management
Save and restore named terminal layouts, including split groups.

```bash
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
```

### Metadata Panel
Display per-terminal status pills, progress bars, and structured logs in the sidebar.

```bash
vmux set-status build passing --icon check
vmux set-progress 0.75 --label "Testing..."
vmux log "All tests passed" --level success
```

### Multi-Agent Grid
Launch NxM split terminal grids and broadcast commands to all of them.

```bash
vmux launch-grid --name agents --rows 2 --cols 2
vmux broadcast --grid agents "git pull && npm test"
```

### MCP Server
17 MCP tools let AI agents control vmux via the Model Context Protocol.

```json
{
  "mcpServers": {
    "vmux": {
      "command": "node",
      "args": ["/path/to/vmux/dist/mcp.js"],
      "env": { "VMUX_SOCKET": "<socket path>" }
    }
  }
}
```

Tools: `create_terminal`, `send_command`, `create_notification`, `set_status`, `set_progress`, `add_log`, `save_session`, `restore_session`, `launch_agent_grid`, `broadcast_to_grid`, and more.

## Agent Hook Examples

**Claude Code** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "Notification": [{
      "matcher": "idle_prompt",
      "hooks": [{
        "type": "command",
        "command": "vmux notify --title 'Claude Code' --body 'Waiting for input'"
      }]
    }]
  }
}
```

**Codex** (`~/.codex/config.toml`):
```toml
notify = ["bash", "-c", "vmux notify --title Codex --body 'Done'"]
```

More examples: [docs/agent-hooks.md](docs/agent-hooks.md)

## Keyboard Shortcuts

| Shortcut | Description |
|----------|-------------|
| `Cmd+T` (macOS) / `Ctrl+T` | Create a new vmux terminal |
| `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` | Jump to the latest unread notification |

## Architecture

![Architecture Overview](docs/images/architecture.png)

## Platform Support

| Platform | IPC |
|----------|-----|
| macOS | Unix socket |
| Linux | Unix socket |
| Windows | HTTP fallback |

**VS Code**: 1.99+

## Development

```bash
npm install          # Install dependencies
npm run build        # Build extension + CLI + MCP server
npm run watch        # Rebuild on change
npm test             # Unit and integration tests (24 tests)
npm run test:e2e     # E2E tests in VS Code Extension Host (7 tests)
npm run compile      # TypeScript type-check
npm run package      # Build .vsix package
```

## Documentation

- [Agent Hook Examples](docs/agent-hooks.md)
- [MCP Demo Scenarios](docs/demo-scenario.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
