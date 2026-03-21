## ADDED Requirements

### Requirement: IPC 서버 시작 및 종료
확장 활성화 시 IPC 서버가 자동으로 시작되어야 하며(SHALL), 비활성화 시 정리되어야 한다(SHALL).

#### Scenario: 확장 활성화 시 Unix socket 서버 시작 (macOS/Linux)
- **WHEN** VS Code 확장이 활성화되고 OS가 macOS 또는 Linux이며 설정 `cmux.ipc.type`이 `unix`인 경우
- **THEN** `${XDG_RUNTIME_DIR:-/tmp}/vscode-cmux-${workspaceHash}.sock` 경로에 Unix socket 서버가 생성되어야 한다
- **THEN** 소켓 파일 권한은 0600이어야 한다

#### Scenario: 확장 활성화 시 HTTP 서버 시작 (Windows 또는 설정)
- **WHEN** OS가 Windows이거나 설정 `cmux.ipc.type`이 `http`인 경우
- **THEN** `http://127.0.0.1`에 ephemeral 포트로 HTTP 서버가 시작되어야 한다
- **THEN** 외부 인터페이스에 바인딩되지 않아야 한다(MUST NOT)

#### Scenario: 확장 비활성화 시 정리
- **WHEN** 확장이 비활성화될 때
- **THEN** IPC 서버가 종료되어야 한다
- **THEN** Unix socket 파일이 삭제되어야 한다

#### Scenario: stale 소켓 파일 처리
- **WHEN** 확장 활성화 시 소켓 경로에 이미 파일이 존재하고 연결이 불가능한 경우
- **THEN** 기존 소켓 파일을 삭제하고 새 서버를 시작해야 한다

### Requirement: JSON-RPC 2.0 프로토콜 지원
IPC 서버는 JSON-RPC 2.0 요청을 처리해야 한다(SHALL).

#### Scenario: 유효한 JSON-RPC 요청 처리
- **WHEN** 유효한 JSON-RPC 2.0 요청이 수신되면
- **THEN** 해당 메서드를 실행하고 JSON-RPC 2.0 응답을 반환해야 한다

#### Scenario: 존재하지 않는 메서드 호출
- **WHEN** 등록되지 않은 메서드명으로 요청이 수신되면
- **THEN** JSON-RPC error code `-32601` (Method not found)을 반환해야 한다

#### Scenario: 잘못된 JSON 파싱
- **WHEN** JSON으로 파싱할 수 없는 데이터가 수신되면
- **THEN** JSON-RPC error code `-32700` (Parse error)을 반환해야 한다

#### Scenario: 잘못된 파라미터
- **WHEN** 메서드의 필수 파라미터가 누락되거나 타입이 잘못된 경우
- **THEN** JSON-RPC error code `-32602` (Invalid params)을 반환해야 한다

### Requirement: 다중 윈도우 격리
같은 머신에서 여러 VS Code 윈도우가 열려도 IPC 서버가 충돌하지 않아야 한다(SHALL).

#### Scenario: 서로 다른 워크스페이스
- **WHEN** 두 VS Code 윈도우가 서로 다른 워크스페이스를 열고 있을 때
- **THEN** 각각 별도의 소켓 경로(workspaceHash 기반)로 독립 서버가 실행되어야 한다

#### Scenario: 같은 워크스페이스를 두 번째 윈도우에서 열기
- **WHEN** 이미 소켓이 사용 중인 워크스페이스를 두 번째 윈도우에서 열 때
- **THEN** 기존 소켓 연결을 인계(takeover)하거나 사용자에게 경고해야 한다
