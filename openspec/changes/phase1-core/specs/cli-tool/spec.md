## ADDED Requirements

### Requirement: CLI 소켓 자동 탐지
CLI는 IPC 서버 소켓을 자동으로 탐지해야 한다(SHALL).

#### Scenario: 환경 변수로 소켓 탐지
- **WHEN** `VMUX_SOCKET` 환경 변수가 설정되어 있을 때
- **THEN** 해당 값을 소켓 경로(또는 HTTP URL)로 사용해야 한다

#### Scenario: CLI 옵션으로 소켓 지정
- **WHEN** `--socket` 옵션이 전달되었을 때
- **THEN** 해당 값을 소켓 경로로 사용하고 환경 변수보다 우선해야 한다

#### Scenario: glob 기반 자동 탐색
- **WHEN** 환경 변수와 `--socket` 옵션이 모두 없을 때
- **THEN** `/tmp/vmux-*.sock` 패턴으로 가장 최근 수정된 소켓 파일을 사용해야 한다

#### Scenario: 소켓을 찾을 수 없음
- **WHEN** 어떤 방법으로도 소켓을 찾을 수 없을 때
- **THEN** 명확한 에러 메시지와 함께 exit code 1로 종료해야 한다

### Requirement: 알림 CLI 명령
CLI는 알림 관련 명령을 지원해야 한다(SHALL).

#### Scenario: 알림 생성
- **WHEN** `vmux notify --title "Title" --body "Body" --level error` 실행 시
- **THEN** IPC 서버에 `notification.create` JSON-RPC 요청을 보내야 한다
- **THEN** `--level` 기본값은 `info`여야 한다

#### Scenario: 알림 목록 조회
- **WHEN** `vmux list-notifications --json` 실행 시
- **THEN** IPC 서버에 `notification.list` 요청을 보내고 결과를 JSON으로 출력해야 한다

#### Scenario: 알림 삭제
- **WHEN** `vmux clear-notifications` 실행 시
- **THEN** IPC 서버에 `notification.clear` 요청을 보내야 한다

### Requirement: 터미널 제어 CLI 명령
CLI는 터미널 제어 명령을 지원해야 한다(SHALL).

#### Scenario: 터미널 생성
- **WHEN** `vmux create-terminal --name "agent-1" --cwd /project` 실행 시
- **THEN** IPC 서버에 `terminal.create` 요청을 보내야 한다

#### Scenario: 터미널 목록 조회
- **WHEN** `vmux list-terminals --json` 실행 시
- **THEN** IPC 서버에 `terminal.list` 요청을 보내고 결과를 JSON으로 출력해야 한다

#### Scenario: 터미널에 명령 전송
- **WHEN** `vmux send --terminal "agent-1" "npm test"` 실행 시
- **THEN** IPC 서버에 `terminal.send` 요청을 보내야 한다

#### Scenario: 터미널 포커스
- **WHEN** `vmux focus --terminal "agent-1"` 실행 시
- **THEN** IPC 서버에 `terminal.focus` 요청을 보내야 한다

#### Scenario: 터미널 종료
- **WHEN** `vmux close --terminal "agent-1"` 실행 시
- **THEN** IPC 서버에 `terminal.close` 요청을 보내야 한다

### Requirement: 세션 CLI 명령
CLI는 세션 관리 명령을 지원해야 한다(SHALL).

#### Scenario: 세션 저장
- **WHEN** `vmux save-session --name "dev-setup"` 실행 시
- **THEN** IPC 서버에 `session.save` 요청을 보내야 한다

#### Scenario: 세션 복원
- **WHEN** `vmux restore-session --name "dev-setup"` 실행 시
- **THEN** IPC 서버에 `session.restore` 요청을 보내야 한다

#### Scenario: 세션 목록 조회
- **WHEN** `vmux list-sessions --json` 실행 시
- **THEN** IPC 서버에 `session.list` 요청을 보내고 결과를 JSON으로 출력해야 한다

### Requirement: zero-dependency 단일 바이너리
CLI는 외부 npm 의존성 없이 Node.js 내장 모듈만 사용하는 단일 파일로 번들되어야 한다(SHALL).

#### Scenario: 번들된 CLI 실행
- **WHEN** `node dist/cli.js notify --title "test"` 실행 시
- **THEN** 추가 `npm install` 없이 정상 동작해야 한다

#### Scenario: shebang으로 직접 실행
- **WHEN** `chmod +x dist/cli.js && ./dist/cli.js --help` 실행 시
- **THEN** `#!/usr/bin/env node` shebang으로 직접 실행 가능해야 한다
