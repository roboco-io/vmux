# vmux — VS Code용 에이전트 친화적 터미널 확장

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/roboco-io.vmux)](https://marketplace.visualstudio.com/items?itemName=roboco-io.vmux)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md)

Claude Code, Codex, Gemini CLI 같은 AI 코딩 에이전트를 위한 VS Code 터미널 확장입니다.
에이전트가 터미널에서 알림을 보내고, 세션을 관리하고, 메타데이터를 표시하고, 다중 터미널 워크플로우를 오케스트레이션할 수 있습니다.

> macOS용 네이티브 에이전트 터미널인 [cmux](https://github.com/manaflow-ai/cmux)에서 영감을 받았습니다.

## 설치

```bash
# VS Code Marketplace에서 설치
code --install-extension roboco-io.vmux

# 또는 VS Code 확장 패널에서 "vmux" 검색
```

## 기능

### 알림
에이전트가 VS Code에 알림을 전송합니다 — 상태 표시줄 배지, 사이드바 TreeView, 시스템 팝업.

```bash
vmux notify --title "Claude Code" --body "Task complete"
vmux notify --title "Build" --body "Failed" --level error
```

### 터미널 제어
터미널을 프로그래밍 방식으로 생성, 포커스, 명령 전송, 종료합니다.

```bash
vmux create-terminal --name "agent-1" --cwd /project
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"
```

### 세션 관리
split 그룹을 포함한 터미널 레이아웃을 저장하고 복원합니다.

```bash
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
```

### 메타데이터 패널
터미널별 상태 pill, 진행률 바, 구조화된 로그를 사이드바에 표시합니다.

```bash
vmux set-status build passing --icon check
vmux set-progress 0.75 --label "Testing..."
vmux log "All tests passed" --level success
```

### 다중 에이전트 그리드
NxM 분할 터미널 그리드를 생성하고 모든 터미널에 명령을 브로드캐스트합니다.

```bash
vmux launch-grid --name agents --rows 2 --cols 2
vmux broadcast --grid agents "git pull && npm test"
```

### MCP 서버
17개의 MCP 도구로 AI 에이전트가 Model Context Protocol을 통해 vmux를 제어합니다.

```json
{
  "mcpServers": {
    "vmux": {
      "command": "node",
      "args": ["/path/to/vmux/dist/mcp.js"],
      "env": { "VMUX_SOCKET": "<소켓 경로>" }
    }
  }
}
```

도구: `create_terminal`, `send_command`, `create_notification`, `set_status`, `set_progress`, `add_log`, `save_session`, `restore_session`, `launch_agent_grid`, `broadcast_to_grid` 등.

## 에이전트 훅 예제

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

추가 예제: [docs/agent-hooks.md](docs/agent-hooks.md)

## 키보드 단축키

| 단축키 | 설명 |
|--------|------|
| `Cmd+T` (macOS) / `Ctrl+T` | 새 vmux 터미널 생성 |
| `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` | 최신 미읽은 알림으로 이동 |

## 아키텍처

![Architecture Overview](docs/images/architecture.png)

## 플랫폼 지원

| 플랫폼 | IPC |
|--------|-----|
| macOS | Unix socket |
| Linux | Unix socket |
| Windows | HTTP fallback |

**VS Code**: 1.99+

## 개발

```bash
npm install          # 의존성 설치
npm run build        # 확장 + CLI + MCP 서버 빌드
npm run watch        # 변경 시 자동 재빌드
npm test             # 단위/통합 테스트 (24개)
npm run test:e2e     # VS Code Extension Host E2E 테스트 (7개)
npm run compile      # TypeScript 타입 체크
npm run package      # .vsix 패키지 빌드
```

## 문서

- [에이전트 훅 예제](docs/agent-hooks.md)
- [MCP 데모 시나리오](docs/demo-scenario.md)
- [기여 가이드](CONTRIBUTING.md)

## 라이선스

MIT
