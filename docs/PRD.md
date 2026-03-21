# PRD: vmux — Agent-Friendly Terminal Extension for VS Code

## 1. Overview

### 1.1 Problem Statement

AI 코딩 에이전트(Claude Code, Codex, Gemini CLI 등)가 터미널에서 작업할 때 다음과 같은 문제가 있다:

- **알림 부재**: 에이전트가 입력을 기다리거나 작업을 완료했을 때 사용자에게 알릴 방법이 없다
- **다중 에이전트 관리 불편**: 여러 에이전트를 병렬로 실행할 때 상태를 한눈에 파악하기 어렵다
- **출력 접근 제한**: VS Code Terminal API는 기존 터미널 버퍼 읽기를 지원하지 않는다
- **컨텍스트 부재**: 에이전트가 자신이 어떤 워크스페이스/터미널에서 실행 중인지 알 수 없다
- **메타데이터 표시 불가**: 진행률, 상태, 로그를 터미널 사이드바에 표시할 수 없다

[cmux](https://github.com/manaflow-ai/cmux)는 이 문제를 네이티브 macOS 앱으로 해결했지만, macOS 전용이며 VS Code 워크플로우와 분리되어 있다.

### 1.2 Solution

cmux의 핵심 기능을 VS Code 확장으로 구현하여, VS Code 내에서 에이전트 친화적 터미널 환경을 제공한다.

### 1.3 Target Users

- AI 코딩 에이전트를 VS Code에서 사용하는 개발자
- 여러 터미널/에이전트를 병렬로 관리하는 개발자
- Claude Code, Codex CLI, Gemini CLI 등을 VS Code 통합 터미널에서 실행하는 사용자

### 1.4 Non-Goals

- Ghostty 수준의 GPU 가속 터미널 렌더링 (VS Code 내장 터미널 사용)
- 내장 브라우저 자동화 (VS Code에서는 Simple Browser 또는 별도 확장 사용)
- macOS 이외 플랫폼에서의 cmux 네이티브 앱 대체

---

## 2. cmux 기능 분석 및 매핑

### 2.1 cmux Core Features

| cmux Feature | Description | VS Code 구현 가능성 |
|---|---|---|
| Workspace/Pane/Surface 계층 | Window > Workspace > Pane > Surface > Panel | **높음** — VS Code Terminal Groups + Custom TreeView |
| Agent Notification System | 파란 링, 알림 패널, Cmd+Shift+U | **높음** — StatusBar + TreeView + 알림 API |
| Sidebar Metadata | 상태 pill, 진행률 바, 로그 엔트리 | **높음** — Custom TreeView + Webview |
| CLI/Socket API | Unix socket JSON-RPC | **높음** — Local HTTP server 또는 Unix socket |
| Session Save/Restore | 레이아웃, CWD, 스크롤백 저장 | **중간** — CWD 복원 가능, 스크롤백은 API 제한 |
| Built-in Browser | WebKit 기반 자동화 | **제외** — VS Code Simple Browser로 대체 |
| GPU Terminal Rendering | libghostty 기반 | **제외** — VS Code xterm.js 사용 |
| Environment Variables | VMUX_WORKSPACE_ID 등 자동 주입 | **높음** — Terminal env 옵션 |

### 2.2 VS Code Terminal API 현황

**사용 가능:**
- `createTerminal()` — 이름, shell, CWD, env, 색상, 아이콘 지정
- `TerminalShellIntegration.executeCommand()` — 명령 실행 + 출력 스트리밍
- `TerminalShellExecution.read()` — AsyncIterable<string> 출력 캡처
- `onDidStartTerminalShellExecution` / `onDidEndTerminalShellExecution` — 실행 이벤트
- `onDidOpenTerminal` / `onDidCloseTerminal` — 라이프사이클 이벤트
- `sendText()` — 터미널에 텍스트 전송 (fire-and-forget)

**제한 사항:**
- 기존 터미널 버퍼 읽기 불가 (`TerminalBuffer` API는 proposed, backlog)
- `onDidWriteTerminalData`는 proposed API (marketplace 확장에서 사용 불가)
- `sendText()`는 출력을 캡처할 수 없음
- 터미널 아이콘/색상/마지막 명령 조회 불가

### 2.3 기존 VS Code 확장 분석

| Extension | Downloads | Key Feature | Limitation |
|---|---|---|---|
| Terminal Keeper | ~218K | 세션 저장/복원, 테마 | 전체 세션 저장 미완성 |
| Restore Terminals | ~103K | 시작 시 자동 터미널 생성 | 유지보수 중단 (2022) |
| Terminals Manager | ~72K | JSONC 설정, tmux 연동 | 수동 설정 필요 |
| Terminal Capture | ~22K | 출력 캡처 | 알파, 유지보수 중단 (2019) |

**Gap**: 에이전트 알림, 메타데이터, 프로그래매틱 제어를 제공하는 확장이 없다.

---

## 3. Feature Specification

### Phase 1: Core — Agent Notifications & Session Management

#### F1. Agent Notification System

에이전트가 사용자 주의가 필요할 때 알림을 보내는 시스템.

**기능:**
- CLI 명령 `vmux notify --title "Title" --body "Body"` 지원
- VS Code 상태바에 미읽은 알림 배지 표시
- 알림 TreeView 패널 (사이드바)
- 알림 클릭 시 해당 터미널로 포커스 이동
- 키보드 단축키로 최신 미읽은 알림으로 점프
- macOS/Windows/Linux 시스템 알림 연동 (옵션)
- OSC 9/99/777 터미널 시퀀스 감지 (shell integration 활성 시)

**구현:**
- Local HTTP server (localhost:PORT) 또는 Unix socket으로 CLI → 확장 통신
- `vscode.window.showInformationMessage()` + StatusBarItem + TreeDataProvider

#### F2. Terminal Session Management

named 터미널 세션 생성, 저장, 복원.

**기능:**
- 워크스페이스별 터미널 레이아웃 프리셋 저장/복원
- 터미널 이름, CWD, shell 경로, 환경 변수 설정
- 터미널 그룹 (split) 저장/복원
- `.vscode/vmux-sessions.json` 설정 파일
- 시작 시 자동 복원 옵션

**구현:**
- `vscode.window.createTerminal()` with `TerminalOptions`
- 설정을 workspace storage에 저장
- Command Palette에서 세션 관리

#### F3. Environment Context Injection

에이전트가 자신의 실행 컨텍스트를 알 수 있도록 환경 변수 자동 주입.

**기능:**
- `VMUX_TERMINAL_ID` — 터미널 식별자
- `VMUX_WORKSPACE` — VS Code 워크스페이스 이름
- `VMUX_SESSION` — 세션 이름
- `VMUX_SOCKET` — IPC 소켓/포트 경로
- `VMUX_CWD` — 초기 작업 디렉토리

**구현:**
- `TerminalOptions.env`로 자동 주입
- `TerminalProfileProvider`로 기본 프로파일에 통합

### Phase 2: Metadata & Monitoring

#### F4. Sidebar Metadata Panel

터미널별 상태, 진행률, 로그를 사이드바에 표시.

**기능:**
- 터미널별 상태 pill (아이콘 + 색상 + 텍스트)
- 진행률 바 (0.0~1.0)
- 구조화된 로그 엔트리 (level: info/progress/success/warning/error)
- CLI 명령으로 메타데이터 업데이트:
  - `vmux set-status <key> <value> --icon <name> --color <hex>`
  - `vmux set-progress 0.5 --label "Building..."`
  - `vmux log "message" --level error`

**구현:**
- Custom TreeView + Webview hybrid
- IPC를 통해 CLI에서 메타데이터 수신

#### F5. Terminal Activity Monitor

실행 중인 에이전트 상태 실시간 모니터링.

**기능:**
- 터미널별 활성/유휴 상태 표시
- 마지막 명령 실행 시간
- 셸 통합 활성 시 현재 CWD 표시
- 터미널 종료 코드 표시

**구현:**
- Shell Integration API (`onDidStartTerminalShellExecution`, `onDidEndTerminalShellExecution`)
- `TerminalShellIntegration.cwd`

### Phase 3: Programmable Control & Multi-Agent

#### F6. IPC Server (CLI/API)

외부 에이전트/스크립트가 확장을 프로그래매틱하게 제어.

**기능:**
- Local HTTP server 또는 Unix socket
- JSON-RPC 프로토콜 (cmux 호환 서브셋)
- 지원 메서드:
  - `terminal.create` — 터미널 생성
  - `terminal.list` — 목록 조회
  - `terminal.send` — 텍스트 전송
  - `terminal.focus` — 포커스 이동
  - `terminal.close` — 종료
  - `notification.create` — 알림 생성
  - `notification.list` / `notification.clear`
  - `metadata.set` / `metadata.get` — 상태/진행률/로그
  - `session.save` / `session.restore`
- 번들된 CLI 도구 (`vmux`)

**구현:**
- Node.js `http` 또는 `net` (Unix socket) 서버
- VS Code Extension Host에서 실행
- CLI는 npm global install 또는 확장 내 bin

#### F7. Multi-Agent Orchestration

여러 에이전트를 동시에 실행하고 관리.

**기능:**
- 에이전트 그리드 레이아웃 생성 (예: 2x2 split)
- 전체 터미널에 명령 브로드캐스트
- 에이전트별 독립 알림 상태
- 에이전트 실행 템플릿 (agent launch preset)

**구현:**
- Terminal Groups API로 분할
- `sendText()` 브로드캐스트
- 프리셋은 JSON 설정

#### F8. MCP Server Integration

MCP(Model Context Protocol)를 통해 AI 에이전트가 확장 기능에 접근.

**기능:**
- MCP 서버로 vmux 기능 노출
- AI 에이전트가 MCP tool call로 터미널 제어
- 지원 도구:
  - `create_terminal` / `list_terminals` / `send_command`
  - `create_notification` / `set_status` / `set_progress`
  - `save_session` / `restore_session`

**구현:**
- 확장 내 MCP server 또는 별도 npm 패키지

---

## 4. Technical Architecture

![Architecture Overview](images/architecture.svg)

> 원본 draw.io 파일: [`docs/diagrams/architecture.drawio`](diagrams/architecture.drawio) — draw.io 또는 VS Code Draw.io Integration 확장으로 편집 가능

### 4.1 Tech Stack

- **Language**: TypeScript
- **Build**: esbuild (VS Code extension bundling)
- **IPC**: Node.js `net` module (Unix socket) + `http` (fallback)
- **Protocol**: JSON-RPC 2.0
- **UI**: VS Code TreeView API + Webview (metadata panel)
- **CLI**: Node.js single-file CLI (npx 또는 global install)
- **Testing**: Mocha + VS Code Extension Test Runner

### 4.2 Extension Manifest (package.json key areas)

```jsonc
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "vmux",
        "title": "vmux",
        "icon": "resources/vmux-icon.svg"
      }]
    },
    "views": {
      "vmux": [
        { "id": "vmux.notifications", "name": "Notifications" },
        { "id": "vmux.terminals", "name": "Terminals" },
        { "id": "vmux.sessions", "name": "Sessions" }
      ]
    },
    "commands": [
      { "command": "vmux.createTerminal", "title": "vmux: Create Terminal" },
      { "command": "vmux.saveSession", "title": "vmux: Save Session" },
      { "command": "vmux.restoreSession", "title": "vmux: Restore Session" },
      { "command": "vmux.jumpToNotification", "title": "vmux: Jump to Latest Notification" },
      { "command": "vmux.clearNotifications", "title": "vmux: Clear Notifications" },
      { "command": "vmux.launchAgentGrid", "title": "vmux: Launch Agent Grid" }
    ],
    "keybindings": [
      { "command": "vmux.jumpToNotification", "key": "cmd+shift+u", "mac": "cmd+shift+u" }
    ],
    "configuration": {
      "title": "vmux",
      "properties": {
        "vmux.ipc.type": { "type": "string", "enum": ["unix", "http"], "default": "unix" },
        "vmux.ipc.port": { "type": "number", "default": 0 },
        "vmux.autoRestore": { "type": "boolean", "default": false },
        "vmux.systemNotifications": { "type": "boolean", "default": true },
        "vmux.envPrefix": { "type": "string", "default": "VMUX" }
      }
    }
  }
}
```

---

## 5. Phased Delivery

| Phase | Features | Priority |
|---|---|---|
| **Phase 1** | F1 Notifications, F2 Sessions, F3 Env Context | Must Have |
| **Phase 2** | F4 Sidebar Metadata, F5 Activity Monitor | Should Have |
| **Phase 3** | F6 IPC Server, F7 Multi-Agent, F8 MCP | Nice to Have |

### Phase 1 상세 마일스톤

| Milestone | Deliverable |
|---|---|
| M1.1 | 프로젝트 scaffolding (TypeScript, esbuild, test setup) |
| M1.2 | IPC server (Unix socket + HTTP fallback) + CLI 도구 |
| M1.3 | 알림 시스템 (CLI → IPC → StatusBar + TreeView) |
| M1.4 | 터미널 세션 저장/복원 |
| M1.5 | 환경 변수 주입 + 터미널 프로파일 |
| M1.6 | 에이전트 hook 예제 (Claude Code, Codex, Gemini CLI) |

---

## 6. CLI Design

### 6.1 명령어 체계

cmux CLI와의 호환성을 고려하되, `vmux` prefix 사용.

```bash
# Notifications
vmux notify --title "Claude Code" --body "Task complete"
vmux notify --title "Build" --body "Failed" --level error
vmux list-notifications [--json]
vmux clear-notifications

# Terminal Control
vmux create-terminal --name "agent-1" --cwd /project
vmux list-terminals [--json]
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"

# Metadata (Phase 2)
vmux set-status <key> <value> --icon <name> --color <hex>
vmux set-progress 0.75 --label "Testing..."
vmux log "Build succeeded" --level success

# Sessions
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
vmux list-sessions
```

### 6.2 Agent Hook Examples

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

---

## 7. Compatibility

### 7.1 cmux CLI Compatibility Layer

cmux가 설치되어 있지 않은 환경에서 `cmux` 명령을 `vmux`로 fallback하는 shim 제공 (선택적).

### 7.2 Platform Support

| Platform | Support |
|---|---|
| macOS | Full |
| Linux | Full (Unix socket) |
| Windows | HTTP fallback (Unix socket → named pipe) |

### 7.3 VS Code Version

- Minimum: 1.99 (Shell Integration executeCommand API 안정화)
- Recommended: 1.105+

---

## 8. Success Metrics

- Phase 1 완료 후 VS Code Marketplace 퍼블리시
- 에이전트 hook 설정 5분 이내 완료 가능
- 알림 전달 지연 < 500ms (CLI → VS Code 표시)
- 세션 복원 정확도 > 95% (이름, CWD, 분할 레이아웃)

---

## 9. Open Questions

1. **IPC 방식**: Unix socket vs HTTP vs 둘 다? → 현재 결정: 둘 다 (Unix 기본, HTTP fallback)
2. **CLI 배포**: npm global install vs 확장 내 번들? → 현재 결정: 둘 다 지원
3. **cmux 호환 모드**: cmux CLI와 동일한 명령어 체계를 그대로 사용할 것인가? → TBD
4. **Proposed API 사용**: `onDidWriteTerminalData`를 사용하면 Marketplace 게시 불가. Insiders용 기능으로 분리할 것인가? → TBD
5. **MCP Server 위치**: 확장 내장 vs 별도 npm 패키지? → TBD

---

## 10. References

- [cmux GitHub](https://github.com/manaflow-ai/cmux) — Agent-friendly terminal (macOS, Swift)
- [cmux-agent-mcp](https://glama.ai/mcp/servers/multiagentcognition/cmux-agent-mcp) — MCP server for cmux (81 tools)
- [VS Code Terminal API](https://code.visualstudio.com/api/references/vscode-api) — Terminal, Shell Integration
- [VS Code Terminal Buffer Proposal](https://github.com/microsoft/vscode/issues/207504) — Proposed TerminalBuffer API
- [Terminal Shell Integration](https://code.visualstudio.com/docs/terminal/shell-integration) — Shell integration docs
- [Cline](https://github.com/cline/cline) — AI agent using shell integration for output capture
- [Terminal Keeper](https://marketplace.visualstudio.com/items?itemName=nguyenngoclong.terminal-keeper) — Session save/restore
