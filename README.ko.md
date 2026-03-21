# vmux — VS Code용 에이전트 친화적 터미널 확장

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md)

Claude Code, Codex, Gemini CLI 같은 AI 코딩 에이전트를 위한 VS Code 터미널 확장입니다.
에이전트가 터미널에서 알림을 보내고, 세션을 관리하고, 자신의 실행 컨텍스트를 파악할 수 있게 해줍니다.

> macOS용 네이티브 에이전트 터미널인 [cmux](https://github.com/manaflow-ai/cmux)에서 영감을 받았습니다.

## 주요 기능

### Phase 1: Core (구현 완료)
- **에이전트 알림 시스템** — 에이전트가 사용자 주의가 필요할 때 알림 전송 (상태 표시줄 배지 + Tree View + 시스템 알림)
- **터미널 세션 관리** — split 그룹을 포함한 이름 있는 터미널 세션 생성, 저장, 복원
- **환경 컨텍스트 주입** — `VMUX_*` 환경 변수 자동 주입
- **IPC 서버** — Unix socket(macOS/Linux) 기반 JSON-RPC 2.0, Windows에서는 HTTP fallback
- **CLI 도구** — `vmux` 명령으로 외부에서 확장 제어

### Phase 2: Metadata & Monitoring (구현 완료)
- **사이드바 메타데이터 패널** — 터미널별 상태 pill, 진행률 바, 구조화된 로그 (`vmux set-status`, `set-progress`, `log`)
- **터미널 활동 모니터** — Shell Integration API로 active/idle 상태, 마지막 명령 시간, CWD, 종료 코드를 추적

### Phase 3: Programmable Control (구현 완료)
- **다중 에이전트 오케스트레이션** — 에이전트 그리드 레이아웃 (`vmux launch-grid`), 명령 브로드캐스트 (`vmux broadcast`), 실행 템플릿
- **MCP 서버 통합** — 터미널, 알림, 세션, 메타데이터, 그리드를 제어할 수 있는 17개의 MCP 도구 제공

## 아키텍처

![Architecture Overview](docs/images/architecture.png)

> 원본 draw.io 파일: [`docs/diagrams/architecture.drawio`](docs/diagrams/architecture.drawio)

## 빠른 시작

### 1. 설치

```bash
# 개발 모드: VS Code에서 F5를 눌러 Extension Development Host 실행
# 또는 VSIX 직접 설치
code --install-extension vmux-0.1.0.vsix
```

### 2. CLI 사용

VS Code 터미널에서, 확장이 `VMUX_SOCKET`을 자동 주입한 상태로:

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

### 3. 에이전트 훅 설정

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
| `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` | 최신 미읽은 알림으로 이동 |

## 플랫폼 지원

| Platform | IPC |
|----------|-----|
| macOS | Unix socket (full) |
| Linux | Unix socket (full) |
| Windows | HTTP fallback |

**VS Code**: 최소 1.99, 권장 1.105+

## 개발

```bash
npm install          # 의존성 설치
npm run build        # 확장, CLI, MCP 서버 빌드
npm run watch        # 변경 시 자동 재빌드
npm test             # 단위 및 통합 테스트 실행
npm run test:e2e     # VS Code Extension Host에서 E2E 테스트 실행
npm run compile      # TypeScript 타입 체크
npm run package      # .vsix 패키지 빌드
```

## 기술 스택

TypeScript, esbuild, JSON-RPC 2.0, VS Code Extension API(TreeView, StatusBar, Terminal), Node.js `net`/`http`

## 문서

- [PRD](docs/PRD.md) — 제품 요구사항 문서
- [Agent Hook Examples](docs/agent-hooks.md) — Claude Code, Codex, Gemini CLI 설정 가이드
- [MCP Demo Scenario](docs/demo-scenario.md) — vmux MCP 도구 기반 워크플로 예제
- [OpenSpec Design](openspec/changes/phase1-core/) — 제안서, 설계, 스펙, 작업 체크리스트

## 라이선스

MIT
