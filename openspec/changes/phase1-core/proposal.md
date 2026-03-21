## Why

AI 코딩 에이전트(Claude Code, Codex, Gemini CLI)가 VS Code 터미널에서 작업할 때 알림을 보내거나, 세션을 관리하거나, 자신의 실행 컨텍스트를 알 수 있는 방법이 없다. cmux(macOS 네이티브 앱)가 이 문제를 해결하지만 macOS 전용이며 VS Code 워크플로우와 분리되어 있다. VS Code 확장으로 핵심 기능을 구현하여 크로스 플랫폼 에이전트 친화적 터미널 환경을 제공한다.

## What Changes

- VS Code 확장 프로젝트 scaffolding (TypeScript + esbuild)
- IPC Server 구현 (Unix socket 기본 + HTTP fallback, JSON-RPC 2.0 프로토콜)
- CLI 도구 `vmux` 구현 (Node.js 단일 파일, IPC 클라이언트)
- Agent Notification System: CLI → IPC → StatusBar 배지 + TreeView 패널 + 시스템 알림
- Terminal Session Management: 워크스페이스별 터미널 레이아웃 프리셋 저장/복원
- Environment Context Injection: `VMUX_*` 환경 변수 자동 주입
- Activity Bar에 vmux 사이드바 뷰 컨테이너 (Notifications, Terminals, Sessions TreeView)

## Capabilities

### New Capabilities
- `ipc-server`: JSON-RPC 2.0 기반 IPC 서버. Unix socket(macOS/Linux) + HTTP(Windows fallback). CLI/외부 도구 → 확장 통신 채널
- `cli-tool`: `vmux` CLI 바이너리. IPC 서버에 JSON-RPC 요청을 보내는 클라이언트. notify, terminal control, session 명령 지원
- `agent-notifications`: 에이전트 알림 시스템. 알림 생성/목록/삭제, StatusBar 배지, Notifications TreeView, 알림 클릭 시 터미널 포커스, 시스템 알림 연동
- `terminal-sessions`: 터미널 세션 관리. named 터미널 생성, 레이아웃 프리셋 저장/복원, `.vscode/vmux-sessions.json` 설정, 자동 복원 옵션
- `env-context`: 환경 컨텍스트 주입. `VMUX_TERMINAL_ID`, `_WORKSPACE`, `_SESSION`, `_SOCKET`, `_CWD` 자동 설정. TerminalProfileProvider 통합

### Modified Capabilities

## Impact

- **새로운 코드**: VS Code 확장 전체 (TypeScript), CLI 도구 (Node.js)
- **VS Code API 의존**: `vscode.window.createTerminal`, `StatusBarItem`, `TreeDataProvider`, `TerminalProfileProvider`, Shell Integration API
- **런타임 의존**: Node.js `net` (Unix socket), `http` 모듈
- **빌드 의존**: esbuild, TypeScript, @vscode/test-electron, mocha
- **파일 시스템**: `.vscode/vmux-sessions.json` (세션 프리셋), workspace storage (알림 상태)
- **네트워크**: localhost 전용 (Unix socket 또는 HTTP, 외부 노출 없음)
- **플랫폼**: macOS/Linux (Unix socket), Windows (HTTP fallback)
