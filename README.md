# vmux — Agent-Friendly Terminal Extension for VS Code

AI 코딩 에이전트(Claude Code, Codex, Gemini CLI 등)를 위한 VS Code 터미널 확장.
에이전트가 터미널에서 알림을 보내고, 세션을 관리하고, 실행 컨텍스트를 파악할 수 있게 합니다.

> [cmux](https://github.com/manaflow-ai/cmux)(macOS 네이티브 에이전트 터미널)에서 영감을 받았습니다.

## Features

### Phase 1: Core (구현 완료)
- **Agent Notification System** — 에이전트가 사용자 주의가 필요할 때 알림 전송 (StatusBar 배지 + TreeView + 시스템 알림)
- **Terminal Session Management** — named 터미널 세션 생성, 저장, 복원 (split 그룹 포함)
- **Environment Context Injection** — `VMUX_*` 환경 변수 자동 주입
- **IPC Server** — JSON-RPC 2.0 over Unix socket (macOS/Linux) + HTTP fallback (Windows)
- **CLI Tool** — `vmux` 명령으로 외부에서 확장 제어

### Phase 2: Metadata & Monitoring (구현 완료)
- **Sidebar Metadata Panel** — 터미널별 상태 pill, 진행률 바, 구조화된 로그 (`vmux set-status`, `set-progress`, `log`)
- **Terminal Activity Monitor** — Shell Integration API로 active/idle 상태, 마지막 명령 시간, CWD, 종료 코드 추적

### Phase 3: Programmable Control (구현 완료)
- **Multi-Agent Orchestration** — 에이전트 그리드 레이아웃 (`vmux launch-grid`), 명령 브로드캐스트 (`vmux broadcast`), 에이전트 실행 템플릿
- **MCP Server Integration** — 17개 MCP 도구로 AI 에이전트가 터미널/알림/세션/메타데이터/그리드 제어

## Architecture

![Architecture Overview](docs/images/architecture.png)

> 원본 draw.io 파일: [`docs/diagrams/architecture.drawio`](docs/diagrams/architecture.drawio)

## Quick Start

### 1. 설치

```bash
# 개발 모드: VS Code에서 F5로 Extension Development Host 실행
# 또는 VSIX 직접 설치
code --install-extension vmux-0.1.0.vsix
```

### 2. CLI 사용

VS Code 터미널에서 (확장이 `VMUX_SOCKET`을 자동 주입):

```bash
# 알림 보내기
vmux notify --title "Claude Code" --body "Task complete"
vmux notify --title "Build" --body "Failed" --level error

# 터미널 제어
vmux create-terminal --name "agent-1" --cwd /project
vmux list-terminals --json
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"

# 세션 관리
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
vmux list-sessions --json
```

### 3. 에이전트 Hook 설정

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

더 많은 예제: [docs/agent-hooks.md](docs/agent-hooks.md)

## Keyboard Shortcuts

| 단축키 | 설명 |
|--------|------|
| `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` | 최신 미읽은 알림으로 점프 |

## Platform Support

| Platform | IPC |
|----------|-----|
| macOS | Unix socket (full) |
| Linux | Unix socket (full) |
| Windows | HTTP fallback |

**VS Code**: 최소 1.99, 권장 1.105+

## Development

```bash
npm install          # 의존성 설치
npm run build        # Extension + CLI 빌드
npm run watch        # 변경 감지 자동 빌드
npm test             # 단위/통합 테스트 (14 tests)
npm run test:e2e     # E2E 테스트 (VS Code Extension Host)
npm run compile      # TypeScript 타입 체크
npm run package      # .vsix 패키지 빌드
```

## Tech Stack

TypeScript, esbuild, JSON-RPC 2.0, VS Code Extension API (TreeView, StatusBar, Terminal), Node.js `net`/`http`

## Documentation

- [PRD](docs/PRD.md) — Product Requirements Document
- [Agent Hook Examples](docs/agent-hooks.md) — Claude Code, Codex, Gemini CLI 설정 가이드
- [OpenSpec Design](openspec/changes/phase1-core/) — proposal, design, specs, tasks

## License

MIT
