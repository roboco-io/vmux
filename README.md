# vmux — Agent-Friendly Terminal Extension for VS Code

[English](README.md) | [Korean](README.ko.md) | [Japanese](README.ja.md)

VS Code terminal extension for AI coding agents such as Claude Code, Codex, and Gemini CLI.
It lets agents send notifications, manage sessions, and understand their execution context directly from the terminal.

> Inspired by [cmux](https://github.com/manaflow-ai/cmux), a native agent terminal for macOS.

## Features

### Phase 1: Core (implemented)
- **Agent Notification System** — Send notifications when an agent needs user attention (Status Bar badge + Tree View + system notifications)
- **Terminal Session Management** — Create, save, and restore named terminal sessions, including split groups
- **Environment Context Injection** — Automatically inject `VMUX_*` environment variables
- **IPC Server** — JSON-RPC 2.0 over Unix socket (macOS/Linux) with HTTP fallback (Windows)
- **CLI Tool** — Control the extension externally with the `vmux` command

### Phase 2: Metadata & Monitoring (implemented)
- **Sidebar Metadata Panel** — Per-terminal status pills, progress bars, and structured logs (`vmux set-status`, `set-progress`, `log`)
- **Terminal Activity Monitor** — Track active/idle state, last command time, CWD, and exit codes through the Shell Integration API

### Phase 3: Programmable Control (implemented)
- **Multi-Agent Orchestration** — Agent grid layouts (`vmux launch-grid`), command broadcast (`vmux broadcast`), and launch templates
- **MCP Server Integration** — 17 MCP tools so AI agents can control terminals, notifications, sessions, metadata, and grids

## Architecture

![Architecture Overview](docs/images/architecture.png)

> Source draw.io file: [`docs/diagrams/architecture.drawio`](docs/diagrams/architecture.drawio)

## Quick Start

### 1. Install

```bash
# Development mode: press F5 in VS Code to launch an Extension Development Host
# Or install the VSIX directly
code --install-extension vmux-0.1.0.vsix
```

### 2. Use the CLI

From a VS Code terminal, where the extension auto-injects `VMUX_SOCKET`:

```bash
# Send notifications
vmux notify --title "Claude Code" --body "Task complete"
vmux notify --title "Build" --body "Failed" --level error

# Control terminals
vmux create-terminal --name "agent-1" --cwd /project
vmux list-terminals --json
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"

# Manage sessions
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
vmux list-sessions --json
```

### 3. Configure agent hooks

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

## Keyboard Shortcut

| Shortcut | Description |
|----------|-------------|
| `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` | Jump to the latest unread notification |

## Platform Support

| Platform | IPC |
|----------|-----|
| macOS | Unix socket (full) |
| Linux | Unix socket (full) |
| Windows | HTTP fallback |

**VS Code**: minimum 1.99, recommended 1.105+

## Development

```bash
npm install          # Install dependencies
npm run build        # Build the extension, CLI, and MCP server
npm run watch        # Rebuild automatically on change
npm test             # Run unit and integration tests
npm run test:e2e     # Run E2E tests in the VS Code Extension Host
npm run compile      # Type-check with TypeScript
npm run package      # Build the .vsix package
```

## Tech Stack

TypeScript, esbuild, JSON-RPC 2.0, the VS Code Extension API (TreeView, StatusBar, Terminal), and Node.js `net`/`http`

## Documentation

- [PRD](docs/PRD.md) — Product Requirements Document
- [Agent Hook Examples](docs/agent-hooks.md) — Setup guide for Claude Code, Codex, and Gemini CLI
- [MCP Demo Scenario](docs/demo-scenario.md) — Example workflows driven by the vmux MCP tools
- [OpenSpec Design](openspec/changes/phase1-core/) — Proposal, design, specs, and task checklist

## License

MIT
