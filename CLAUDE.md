# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vmux** is an agent-friendly terminal extension for VS Code, inspired by [cmux](https://github.com/manaflow-ai/cmux), a native macOS app. It enables agents such as Claude Code, Codex, and Gemini CLI to send notifications, manage sessions, and display metadata from the terminal.

**Current status**: The core implementation described in the README is present in the repository. The PRD (`docs/PRD.md`) and OpenSpec documents remain useful as design and reference material.

## Tech Stack

- **Language**: TypeScript
- **Build**: esbuild (VS Code extension bundling)
- **IPC**: Node.js `net` (Unix socket) + `http` (fallback)
- **Protocol**: JSON-RPC 2.0
- **UI**: VS Code TreeView API + Webview
- **Testing**: Mocha + VS Code Extension Test Runner
- **VS Code**: minimum 1.99, recommended 1.105+

## Architecture

```text
Extension Host
├── IPC Server (Unix socket by default, HTTP fallback)
├── Notification Manager → StatusBar badge + TreeView
├── Session Manager → workspace storage
└── Terminal Manager → env injection + profile provider

External
├── CLI Tool (vmux) ──→ IPC Server (JSON-RPC)
├── MCP Server (optional) ──→ IPC Server
└── Agent Hooks (claude/codex/gemini) ──→ CLI Tool
```

- **Sidebar**: a vmux icon in the Activity Bar with Notifications, Terminals, Sessions, and Metadata panels
- **CLI**: a Node.js single-file `vmux` binary that communicates with the extension over IPC
- **Environment variables**: automatically injected with the `VMUX_*` prefix (terminal ID, workspace, session, socket path, CWD)

## Phased Implementation

| Phase | Features | Priority |
|-------|----------|----------|
| **1** | F1 notification system, F2 session management, F3 environment context injection | Must Have |
| **2** | F4 sidebar metadata, F5 terminal activity monitor | Should Have |
| **3** | F6 full IPC surface, F7 multi-agent features, F8 MCP server | Nice to Have |

Phase 1 milestone order: scaffolding → IPC server + CLI → notifications → sessions → env injection → agent hook examples

## Key Design Decisions

- IPC uses Unix sockets by default with an HTTP fallback on Windows
- CLI distribution supports both npm global install and bundling inside the extension
- `onDidWriteTerminalData` is a proposed API and cannot be used in a Marketplace extension, so Shell Integration APIs are used instead
- Existing terminal buffers cannot be read (`TerminalBuffer` remains proposed/backlogged)
- Full cmux CLI compatibility remains undecided

## Platform Support

| Platform | IPC |
|----------|-----|
| macOS | Unix socket (full) |
| Linux | Unix socket (full) |
| Windows | HTTP fallback |
