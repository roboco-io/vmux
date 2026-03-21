## ADDED Requirements

### Requirement: 환경 변수 자동 주입
확장이 관리하는 모든 터미널에 `VSCODE_CMUX_*` 환경 변수가 주입되어야 한다(SHALL).

#### Scenario: 확장으로 생성한 터미널
- **WHEN** `terminal.create` 요청으로 터미널이 생성될 때
- **THEN** 다음 환경 변수가 자동 설정되어야 한다:
  - `VSCODE_CMUX_TERMINAL_ID`: 고유 터미널 식별자
  - `VSCODE_CMUX_WORKSPACE`: VS Code 워크스페이스 이름
  - `VSCODE_CMUX_SESSION`: 현재 세션 이름 (없으면 빈 문자열)
  - `VSCODE_CMUX_SOCKET`: IPC 소켓 경로 또는 HTTP URL
  - `VSCODE_CMUX_CWD`: 초기 작업 디렉토리

#### Scenario: TerminalProfileProvider를 통한 터미널
- **WHEN** 사용자가 cmux 터미널 프로파일을 선택하여 터미널을 열 때
- **THEN** 동일한 `VSCODE_CMUX_*` 환경 변수가 주입되어야 한다

#### Scenario: 사용자 환경 변수와의 병합
- **WHEN** `terminal.create` 요청에 `env` 파라미터가 포함되고 `VSCODE_CMUX_*` 키가 없을 때
- **THEN** 사용자 환경 변수와 `VSCODE_CMUX_*` 변수가 병합되어야 한다
- **THEN** 사용자가 `VSCODE_CMUX_*` 키를 명시적으로 지정하면 사용자 값이 우선해야 한다

### Requirement: TerminalProfileProvider 등록
cmux 터미널 프로파일이 VS Code에 등록되어야 한다(SHALL).

#### Scenario: 프로파일 등록
- **WHEN** 확장이 활성화될 때
- **THEN** "cmux" 이름의 터미널 프로파일이 VS Code에 등록되어야 한다
- **THEN** 사용자가 터미널 드롭다운에서 이 프로파일을 선택할 수 있어야 한다

#### Scenario: 프로파일로 터미널 생성
- **WHEN** 사용자가 "cmux" 프로파일을 선택하여 터미널을 생성할 때
- **THEN** 기본 셸과 동일하지만 `VSCODE_CMUX_*` 환경 변수가 포함된 터미널이 생성되어야 한다

### Requirement: 환경 변수 prefix 커스터마이징
환경 변수 prefix를 설정으로 변경할 수 있어야 한다(SHALL).

#### Scenario: 기본 prefix
- **WHEN** 설정 `cmux.envPrefix`가 기본값 `VSCODE_CMUX`일 때
- **THEN** 환경 변수 이름이 `VSCODE_CMUX_*`로 설정되어야 한다

#### Scenario: 커스텀 prefix
- **WHEN** 설정 `cmux.envPrefix`가 `MY_AGENT`로 변경되었을 때
- **THEN** 환경 변수 이름이 `MY_AGENT_TERMINAL_ID`, `MY_AGENT_WORKSPACE` 등으로 설정되어야 한다

### Requirement: Terminals TreeView
관리 중인 터미널 목록을 사이드바 TreeView로 표시해야 한다(SHALL).

#### Scenario: 터미널 목록 표시
- **WHEN** Terminals TreeView가 열려 있을 때
- **THEN** 확장이 관리하는 모든 터미널이 이름과 함께 표시되어야 한다
- **THEN** 각 터미널의 CWD와 활성/종료 상태가 표시되어야 한다

#### Scenario: 터미널 클릭 시 포커스
- **WHEN** 사용자가 TreeView에서 터미널 항목을 클릭할 때
- **THEN** 해당 터미널로 포커스가 이동해야 한다

#### Scenario: 터미널 종료 감지
- **WHEN** 확장이 관리하는 터미널이 종료될 때
- **THEN** TreeView에서 해당 항목이 제거되거나 종료 상태로 표시되어야 한다
