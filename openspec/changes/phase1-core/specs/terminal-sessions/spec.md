## ADDED Requirements

### Requirement: 세션 프리셋 저장
현재 열린 터미널 상태를 named 프리셋으로 저장할 수 있어야 한다(SHALL).

#### Scenario: 세션 저장
- **WHEN** `session.save` 요청이 `name` 파라미터와 함께 수신되면
- **THEN** 현재 열린 모든 터미널의 이름, CWD, 환경 변수, 셸 경로를 캡처해야 한다
- **THEN** `.vscode/cmux-sessions.json` 파일에 해당 이름으로 프리셋을 저장해야 한다

#### Scenario: 동일 이름 세션 덮어쓰기
- **WHEN** 이미 존재하는 세션 이름으로 저장 요청이 수신되면
- **THEN** 기존 프리셋을 새 상태로 덮어써야 한다

#### Scenario: Command Palette에서 세션 저장
- **WHEN** 사용자가 Command Palette에서 `cmux: Save Session`을 실행할 때
- **THEN** 세션 이름 입력 프롬프트가 표시되어야 한다
- **THEN** 이름 입력 후 현재 터미널 상태가 저장되어야 한다

### Requirement: 세션 프리셋 복원
저장된 프리셋으로 터미널을 복원할 수 있어야 한다(SHALL).

#### Scenario: 세션 복원
- **WHEN** `session.restore` 요청이 `name` 파라미터와 함께 수신되면
- **THEN** 해당 프리셋에 정의된 각 터미널이 이름, CWD, 환경 변수, 셸 경로와 함께 생성되어야 한다

#### Scenario: split 터미널 그룹 복원
- **WHEN** 프리셋에 동일한 `group` 번호를 가진 터미널이 여러 개 있을 때
- **THEN** 해당 터미널들이 split 그룹으로 생성되어야 한다

#### Scenario: 존재하지 않는 세션 복원
- **WHEN** 저장되지 않은 세션 이름으로 복원 요청이 수신되면
- **THEN** "세션을 찾을 수 없습니다" 에러를 반환해야 한다

#### Scenario: Command Palette에서 세션 복원
- **WHEN** 사용자가 Command Palette에서 `cmux: Restore Session`을 실행할 때
- **THEN** 저장된 세션 목록이 QuickPick으로 표시되어야 한다
- **THEN** 선택한 세션이 복원되어야 한다

### Requirement: 세션 목록 조회
저장된 세션 프리셋 목록을 조회할 수 있어야 한다(SHALL).

#### Scenario: 세션 목록 반환
- **WHEN** `session.list` 요청이 수신되면
- **THEN** 모든 저장된 세션 프리셋의 이름과 터미널 수를 반환해야 한다

### Requirement: Sessions TreeView
저장된 세션을 사이드바 TreeView로 표시해야 한다(SHALL).

#### Scenario: 세션 목록 표시
- **WHEN** Sessions TreeView가 열려 있을 때
- **THEN** 저장된 모든 세션 프리셋이 표시되어야 한다
- **THEN** 각 세션 하위에 터미널 이름과 CWD가 표시되어야 한다

#### Scenario: TreeView에서 세션 복원
- **WHEN** 사용자가 TreeView에서 세션 항목의 "복원" 버튼을 클릭할 때
- **THEN** 해당 세션이 복원되어야 한다

#### Scenario: TreeView에서 세션 삭제
- **WHEN** 사용자가 TreeView에서 세션 항목의 "삭제" 버튼을 클릭할 때
- **THEN** 해당 세션 프리셋이 `.vscode/cmux-sessions.json`에서 제거되어야 한다

### Requirement: 자동 복원
워크스페이스 열릴 때 마지막 터미널 상태를 자동 복원할 수 있어야 한다(SHALL).

#### Scenario: 자동 복원 활성화
- **WHEN** 설정 `cmux.autoRestore`가 `true`이고 워크스페이스가 열릴 때
- **THEN** 마지막으로 저장된 터미널 상태가 자동으로 복원되어야 한다

#### Scenario: 자동 복원 비활성화
- **WHEN** 설정 `cmux.autoRestore`가 `false`일 때
- **THEN** 자동 복원이 실행되지 않아야 한다(MUST NOT)
