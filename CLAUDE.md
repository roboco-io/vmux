# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vmux** — AI 에이전트 친화적 터미널 VS Code 확장. [cmux](https://github.com/manaflow-ai/cmux)(macOS 네이티브 앱)에서 영감을 받아 제작. Claude Code, Codex, Gemini CLI 등의 에이전트가 터미널에서 알림을 보내고, 세션을 관리하고, 메타데이터를 표시할 수 있게 한다.

**현재 상태**: 구현 전 단계. PRD(`docs/PRD.md`)와 아키텍처 다이어그램만 존재.

## Tech Stack

- **Language**: TypeScript
- **Build**: esbuild (VS Code extension bundling)
- **IPC**: Node.js `net` (Unix socket) + `http` (fallback)
- **Protocol**: JSON-RPC 2.0
- **UI**: VS Code TreeView API + Webview
- **Testing**: Mocha + VS Code Extension Test Runner
- **VS Code**: 최소 1.99, 권장 1.105+

## Architecture

```
Extension Host
├── IPC Server (Unix socket 기본, HTTP fallback)
├── Notification Manager → StatusBar Badge + TreeView
├── Session Manager → workspace storage
└── Terminal Manager → env injection + profile provider

External
├── CLI Tool (vmux) ──→ IPC Server (JSON-RPC)
├── MCP Server (optional) ──→ IPC Server
└── Agent Hooks (claude/codex/gemini) ──→ CLI Tool
```

- **Sidebar**: Activity Bar에 vmux 아이콘 → Notifications / Terminals / Sessions TreeView 3개 패널
- **CLI**: `vmux` Node.js 단일 파일 바이너리. IPC로 확장과 통신
- **환경 변수**: `VMUX_*` prefix로 터미널에 자동 주입 (terminal ID, workspace, session, socket path, CWD)

## Phased Implementation

| Phase | 기능 | 우선순위 |
|-------|------|----------|
| **1** | F1 알림 시스템, F2 세션 관리, F3 환경 컨텍스트 주입 | Must Have |
| **2** | F4 사이드바 메타데이터, F5 터미널 활동 모니터 | Should Have |
| **3** | F6 IPC Server 전체, F7 다중 에이전트, F8 MCP Server | Nice to Have |

Phase 1 마일스톤 순서: scaffolding → IPC server + CLI → 알림 → 세션 → env 주입 → agent hook 예제

## Key Design Decisions

- IPC는 Unix socket 기본 + HTTP fallback (Windows는 named pipe 대신 HTTP)
- CLI 배포는 npm global install과 확장 내 번들 둘 다 지원
- `onDidWriteTerminalData`는 proposed API라 Marketplace 게시 불가 — Shell Integration API만 사용
- 기존 터미널 버퍼 읽기 불가 (`TerminalBuffer` API는 proposed/backlog)
- cmux CLI 호환 모드 여부는 미정

## Platform Support

| Platform | IPC |
|----------|-----|
| macOS | Unix socket (full) |
| Linux | Unix socket (full) |
| Windows | HTTP fallback |
