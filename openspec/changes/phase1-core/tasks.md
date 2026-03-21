## 1. Project Scaffolding

- [x] 1.1 `npm init`으로 package.json 생성, TypeScript/esbuild/eslint/prettier 의존성 추가
- [x] 1.2 tsconfig.json 설정 (strict mode, Node.js + VS Code 타입)
- [x] 1.3 esbuild 빌드 스크립트 구성 (extension + CLI 이중 번들, watch 모드)
- [x] 1.4 VS Code extension manifest 작성 (contributes: viewsContainers, views, commands, keybindings, configuration)
- [x] 1.5 디렉토리 구조 생성: `src/extension/`, `src/cli/`, `src/shared/`, `src/test/`
- [x] 1.6 .vscodeignore, .gitignore 설정
- [x] 1.7 Extension entry point (`extension.ts`) 스켈레톤: activate/deactivate

## 2. Shared Protocol & Types

- [x] 2.1 `src/shared/types.ts` 작성: Notification, SessionPreset, TerminalInfo 인터페이스
- [x] 2.2 `src/shared/protocol.ts` 작성: JSON-RPC 2.0 요청/응답 타입, 메서드별 파라미터/결과 타입
- [x] 2.3 JSON-RPC 유틸리티 함수: createRequest, createResponse, createError, parseMessage

## 3. IPC Server

- [x] 3.1 `src/extension/ipc/server.ts`: IpcServer 추상 인터페이스 (start, stop, onRequest)
- [x] 3.2 `src/extension/ipc/unix-socket-server.ts`: Node.js `net` 기반 Unix socket 서버 구현
- [x] 3.3 `src/extension/ipc/http-server.ts`: Node.js `http` 기반 HTTP 서버 구현
- [x] 3.4 소켓 경로 생성 로직: workspaceHash(SHA-256 앞 8자) + XDG_RUNTIME_DIR fallback
- [x] 3.5 stale 소켓 파일 감지 및 정리 로직
- [x] 3.6 JSON-RPC 메서드 라우터: 메서드명 → 핸들러 매핑, 에러 코드(-32601, -32700, -32602) 처리
- [x] 3.7 플랫폼별 자동 선택: macOS/Linux → Unix socket, Windows → HTTP
- [x] 3.8 extension.ts에서 IPC 서버 시작/종료 연결 (activate/deactivate)
- [x] 3.9 IPC 서버 단위 테스트: 요청 파싱, 에러 응답, 소켓 생성/정리

## 4. CLI Tool

- [x] 4.1 `src/cli/index.ts`: argv 파서 (내장 `process.argv` 기반, 외부 의존성 없음)
- [x] 4.2 소켓 탐지 로직: VSCODE_CMUX_SOCKET → --socket 옵션 → /tmp glob 순서
- [x] 4.3 JSON-RPC 클라이언트: Unix socket(`net`) + HTTP(`http`) 요청 전송
- [x] 4.4 notify 명령: --title, --body, --level 파싱 → notification.create 요청
- [x] 4.5 list-notifications / clear-notifications 명령 구현
- [x] 4.6 create-terminal / list-terminals / send / focus / close 명령 구현
- [x] 4.7 save-session / restore-session / list-sessions 명령 구현
- [x] 4.8 --json 플래그: JSON 출력 포맷, --help 플래그: 사용법 출력
- [x] 4.9 에러 처리: 소켓 연결 실패, 타임아웃, JSON-RPC 에러 → 사용자 친화적 메시지
- [x] 4.10 esbuild로 단일 파일 번들 + shebang 삽입 확인
- [x] 4.11 CLI 통합 테스트: 실제 소켓 연결 → 요청/응답 검증

## 5. Agent Notifications

- [x] 5.1 `src/extension/notifications/manager.ts`: NotificationManager (생성, 조회, 삭제, 읽음 처리)
- [x] 5.2 Notification 인메모리 저장소: Map<id, Notification>, timestamp 역순 정렬
- [x] 5.3 IPC 메서드 핸들러 등록: notification.create, notification.list, notification.clear
- [x] 5.4 `src/extension/views/notifications-tree.ts`: NotificationsTreeDataProvider 구현
- [x] 5.5 TreeView 항목: level별 아이콘(info/warning/error), title, timestamp, read 상태 스타일
- [x] 5.6 알림 클릭 → 터미널 포커스 이동 + read 상태 변경
- [x] 5.7 StatusBarItem: 미읽은 알림 수 배지, bell 아이콘, 클릭 시 TreeView 포커스
- [x] 5.8 `cmux.jumpToNotification` 커맨드: 최신 미읽은 알림 → 터미널 포커스
- [x] 5.9 keybinding 등록: Cmd+Shift+U (macOS) / Ctrl+Shift+U (Windows/Linux)
- [x] 5.10 시스템 알림: cmux.systemNotifications 설정에 따라 showInformationMessage/Warning/Error 호출
- [x] 5.11 알림 시스템 단위 테스트: 생성/조회/삭제/읽음 처리, StatusBar 업데이트

## 6. Terminal Sessions

- [x] 6.1 `src/extension/sessions/manager.ts`: SessionManager (저장, 복원, 목록, 삭제)
- [x] 6.2 세션 프리셋 파일 I/O: `.vscode/cmux-sessions.json` 읽기/쓰기
- [x] 6.3 현재 터미널 상태 캡처: 이름, CWD(가능한 경우), 셸 경로 수집
- [x] 6.4 세션 복원: createTerminal 순차 호출, group 번호에 따른 split 터미널 생성
- [x] 6.5 IPC 메서드 핸들러 등록: session.save, session.restore, session.list
- [x] 6.6 `src/extension/views/sessions-tree.ts`: SessionsTreeDataProvider 구현
- [x] 6.7 TreeView 항목: 세션 이름, 하위에 터미널 목록, 복원/삭제 인라인 버튼
- [x] 6.8 Command Palette 커맨드: cmux.saveSession (이름 입력 프롬프트), cmux.restoreSession (QuickPick)
- [x] 6.9 자동 복원: cmux.autoRestore 설정 → activate 시 마지막 상태 복원
- [x] 6.10 세션 관리 단위 테스트: 저장/복원/목록/삭제, 파일 I/O

## 7. Environment Context & Terminal Management

- [x] 7.1 `src/extension/terminals/manager.ts`: TerminalManager (생성, 목록, 포커스, 종료, 전송)
- [x] 7.2 환경 변수 빌더: cmux.envPrefix 설정 반영, VSCODE_CMUX_* 변수 생성
- [x] 7.3 TerminalProfileProvider 등록: "cmux" 프로파일, 기본 셸 + env 주입
- [x] 7.4 IPC 메서드 핸들러 등록: terminal.create, terminal.list, terminal.focus, terminal.close, terminal.send
- [x] 7.5 `src/extension/views/terminals-tree.ts`: TerminalsTreeDataProvider 구현
- [x] 7.6 TreeView 항목: 터미널 이름, CWD, 활성/종료 상태, 클릭 시 포커스
- [x] 7.7 터미널 라이프사이클 추적: onDidOpenTerminal, onDidCloseTerminal 이벤트 핸들링
- [x] 7.8 터미널 관리 단위 테스트: 생성/목록/포커스/종료, env 주입 검증

## 8. Integration & E2E Testing

- [x] 8.1 @vscode/test-electron 설정: Extension Host 테스트 환경 구성
- [ ] 8.2 E2E 시나리오: CLI notify → TreeView 확인 → 터미널 포커스
- [ ] 8.3 E2E 시나리오: 세션 저장 → 복원 → 터미널 상태 검증
- [ ] 8.4 E2E 시나리오: 환경 변수 주입 확인 (터미널 생성 → env 검증)
- [ ] 8.5 크로스 플랫폼 확인: Unix socket + HTTP fallback 동작 검증

## 9. Documentation & Polish

- [x] 9.1 에이전트 hook 예제 작성: Claude Code, Codex, Gemini CLI 설정 가이드
- [x] 9.2 CHANGELOG.md 초기 버전 작성
- [x] 9.3 extension 아이콘 (resources/cmux-icon.svg) 생성
- [x] 9.4 `vsce package` 로 .vsix 패키지 빌드 확인
