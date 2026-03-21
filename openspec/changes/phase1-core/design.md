## Context

vmux는 AI 코딩 에이전트를 위한 VS Code 터미널 확장이다. 현재 에이전트가 VS Code 터미널에서 사용자에게 알림을 보내거나, 세션을 복원하거나, 자신의 실행 컨텍스트를 파악할 수 있는 표준적인 방법이 없다.

cmux(macOS 네이티브 앱)가 이 문제를 해결하지만 플랫폼 제한이 있다. Phase 1은 확장의 기반(IPC + CLI)과 핵심 3개 기능(알림, 세션, 환경 변수)을 구현한다.

**제약 사항:**
- VS Code 1.99+ (Shell Integration API 안정화 기준)
- Marketplace 게시를 위해 proposed API 사용 불가 (`onDidWriteTerminalData` 등 제외)
- 기존 터미널 버퍼 읽기 불가 (`TerminalBuffer` API는 backlog)

## Goals / Non-Goals

**Goals:**
- 에이전트가 CLI 한 줄로 VS Code에 알림을 보낼 수 있다
- 터미널 세션(이름, CWD, 분할, 환경 변수)을 저장/복원할 수 있다
- 에이전트가 자신의 실행 컨텍스트를 환경 변수로 알 수 있다
- macOS, Linux, Windows 크로스 플랫폼 지원
- 에이전트 hook 설정이 5분 이내에 가능하다

**Non-Goals:**
- Phase 2/3 기능 (메타데이터 패널, 활동 모니터, 다중 에이전트 오케스트레이션, MCP 서버)
- GPU 터미널 렌더링 (VS Code 내장 xterm.js 사용)
- 기존 터미널 출력 캡처 (proposed API 의존)
- cmux CLI 100% 호환 모드 (Phase 1에서는 `vmux` prefix만)

## Decisions

### D1. Extension 구조 — Monorepo (extension + CLI)

하나의 리포지토리에 확장과 CLI를 함께 관리한다.

```
src/
├── extension/          # VS Code Extension Host 코드
│   ├── extension.ts    # activate/deactivate entry point
│   ├── ipc/            # IPC 서버 (Unix socket + HTTP)
│   ├── notifications/  # 알림 매니저 + TreeView
│   ├── sessions/       # 세션 매니저 + TreeView
│   ├── terminals/      # 터미널 매니저 + env injection
│   └── views/          # TreeDataProvider 구현
├── cli/                # vmux CLI
│   └── index.ts        # 단일 진입점
└── shared/             # 공유 타입 + JSON-RPC 프로토콜 정의
    ├── protocol.ts     # JSON-RPC 메서드/파라미터 타입
    └── types.ts        # Notification, Session, Terminal 타입
```

**빌드:**
- Extension: esbuild → `dist/extension.js` (Node.js, CJS)
- CLI: esbuild → `dist/cli.js` (Node.js, CJS, `#!/usr/bin/env node` shebang)

**대안:** 별도 리포지토리 → 프로토콜 동기화 오버헤드, 단일 패키지 관리가 효율적

### D2. IPC 프로토콜 — JSON-RPC 2.0 over Unix socket + HTTP fallback

**Unix socket (macOS/Linux 기본):**
- 소켓 경로: `${XDG_RUNTIME_DIR:-/tmp}/vmux-${workspaceHash}.sock`
- `workspaceHash`: 워크스페이스 URI의 SHA-256 앞 8자리 (다중 윈도우 충돌 방지)
- 파일 권한 0600 (소유자만 접근)

**HTTP fallback (Windows 또는 설정):**
- `http://127.0.0.1:{PORT}` (PORT는 OS가 할당하는 ephemeral port)
- 포트를 환경 변수 `VMUX_SOCKET`에 `http://127.0.0.1:{PORT}` 형태로 주입

**프로토콜:** JSON-RPC 2.0 (batch 미지원). 요청/응답 한 쌍.

```typescript
// Phase 1 메서드
type Methods = {
  'notification.create': { title: string; body?: string; level?: 'info' | 'warning' | 'error'; terminalId?: string }
  'notification.list': {}
  'notification.clear': { id?: string }  // id 없으면 전체 삭제
  'terminal.create': { name: string; cwd?: string; env?: Record<string, string>; shellPath?: string }
  'terminal.list': {}
  'terminal.focus': { name: string }
  'terminal.close': { name: string }
  'terminal.send': { name: string; text: string }
  'session.save': { name: string }
  'session.restore': { name: string }
  'session.list': {}
}
```

**대안:**
- gRPC → 바이너리 프로토콜은 CLI 구현 복잡도 증가, JSON-RPC는 `curl`로도 테스트 가능
- WebSocket → 양방향 필요 없음 (Phase 1은 요청-응답만), 복잡도 불필요

### D3. CLI 설계 — 단일 파일, zero-dependency

CLI는 Node.js 단일 파일로 번들. 외부 의존성 없이 `net` + `http` 모듈만 사용.

```bash
vmux notify --title "Done" --body "Task complete" --level info
vmux list-notifications --json
vmux clear-notifications
vmux create-terminal --name "agent-1" --cwd /project
vmux list-terminals --json
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
vmux list-sessions --json
```

**소켓 탐지 순서:**
1. `VMUX_SOCKET` 환경 변수 (확장이 터미널에 주입)
2. `--socket` CLI 옵션
3. `/tmp/vmux-*.sock` glob → 가장 최근 수정된 소켓

**배포:** 확장 내 `bin/vmux`로 번들 + npm global install 지원 (`package.json` bin 필드)

**대안:** Python/Rust CLI → Node.js는 확장과 타입 공유 가능, 별도 런타임 불필요

### D4. 알림 시스템 — 인메모리 + TreeDataProvider

알림은 Extension Host 메모리에 저장 (워크스페이스 수명과 동일). 영속화 불필요.

```typescript
interface Notification {
  id: string           // nanoid
  title: string
  body?: string
  level: 'info' | 'warning' | 'error'
  terminalId?: string  // 연결된 터미널
  timestamp: number    // Date.now()
  read: boolean
}
```

**UI 구성:**
- `StatusBarItem`: 미읽은 알림 수 배지. 클릭 시 Notifications TreeView로 포커스
- `TreeDataProvider<Notification>`: 시간순 정렬, 아이콘으로 level 표시
- 알림 클릭 → 해당 `terminalId`의 터미널로 포커스 이동
- `Cmd+Shift+U` → 최신 미읽은 알림으로 점프
- 시스템 알림: `vscode.window.showInformationMessage()` (설정으로 on/off)

**대안:** 영속 저장소(globalState) → 알림은 휘발성 데이터, 재시작 시 초기화가 자연스러움

### D5. 세션 관리 — JSON 파일 + workspace storage

**세션 프리셋 저장:**
```typescript
interface SessionPreset {
  name: string
  terminals: {
    name: string
    cwd?: string
    shellPath?: string
    env?: Record<string, string>
    group?: number  // 같은 group 번호는 split terminal
  }[]
}
```

**저장 위치:**
- `.vscode/vmux-sessions.json`: 프로젝트별 프리셋 (git 공유 가능)
- workspace storage: 현재 열린 터미널 상태 자동 저장 (자동 복원용)

**복원 방식:**
1. `vscode.window.createTerminal({ name, cwd, env, shellPath })` 순차 호출
2. 같은 `group` 번호 터미널은 `TerminalLocation.Panel`로 split 그룹 생성
3. 자동 복원: 설정 `vmux.autoRestore: true` → 워크스페이스 열릴 때 마지막 상태 복원

**제한:** 스크롤백 버퍼 복원 불가 (VS Code API 제한). CWD, 이름, 환경 변수만 복원.

**대안:** settings.json에 저장 → 세션 데이터는 VS Code 설정과 분리하는 것이 깔끔

### D6. 환경 변수 주입 — TerminalOptions.env + TerminalProfileProvider

모든 터미널에 자동으로 `VMUX_*` 환경 변수를 주입한다.

```typescript
const env = {
  VMUX_TERMINAL_ID: uniqueId,
  VMUX_WORKSPACE: vscode.workspace.name ?? '',
  VMUX_SESSION: currentSessionName ?? '',
  VMUX_SOCKET: socketPath,  // Unix socket 경로 또는 http://... URL
  VMUX_CWD: cwd,
}
```

**주입 경로:**
1. `TerminalProfileProvider` 등록 → 기본 프로파일에 env 추가
2. `createTerminal()` 호출 시 항상 env 포함
3. `vscode.window.onDidOpenTerminal` → 사용자가 직접 연 터미널도 추적 (env 주입은 API 제한으로 TerminalProfileProvider 경유만 가능)

**대안:** `shellArgs`로 export 명령 주입 → 셸별 분기 필요, env 옵션이 깔끔

### D7. 빌드 시스템 — esbuild + npm scripts

```json
{
  "scripts": {
    "build": "npm run build:ext && npm run build:cli",
    "build:ext": "esbuild src/extension/extension.ts --bundle --outfile=dist/extension.js --platform=node --format=cjs --external:vscode",
    "build:cli": "esbuild src/cli/index.ts --bundle --outfile=dist/cli.js --platform=node --format=cjs --banner:js='#!/usr/bin/env node'",
    "watch": "npm run build:ext -- --watch & npm run build:cli -- --watch",
    "test": "node --test dist/test/**/*.test.js",
    "lint": "eslint src/",
    "package": "vsce package"
  }
}
```

**테스팅:**
- 단위 테스트: Node.js 내장 test runner (`node --test`)
- 통합 테스트: `@vscode/test-electron` (Extension Host 환경)
- IPC 테스트: 실제 소켓/HTTP 연결 테스트

## Risks / Trade-offs

**[Unix socket 파일 잔존]** → 확장 deactivate 시 소켓 파일 삭제 + CLI에서 연결 실패 시 stale 소켓 자동 정리

**[다중 VS Code 윈도우 충돌]** → workspaceHash로 소켓 경로 분리. 같은 워크스페이스를 두 윈도우에서 열면 두 번째가 기존 소켓을 인계(takeover)

**[CLI 소켓 탐지 실패]** → `VMUX_SOCKET` 환경 변수가 최우선. 환경 변수 없으면 glob + mtime 기반 탐색. 실패 시 명확한 에러 메시지

**[Windows Unix socket 미지원]** → HTTP fallback. Windows에서도 동일한 CLI 명령어 동작. 성능 차이 무시 가능 (localhost)

**[터미널 split 그룹 복원 불완전]** → VS Code `createTerminal`의 `location` 옵션으로 Panel에 생성 가능하나, 정확한 split 위치 제어는 제한적. 베스트 에포트 복원

**[TerminalProfileProvider 한계]** → 사용자가 VS Code 기본 프로파일 대신 커스텀 프로파일을 선택해야 env가 주입됨. 확장 활성화 시 기본 프로파일로 등록하여 마찰 최소화
