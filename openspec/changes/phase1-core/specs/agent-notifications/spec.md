## ADDED Requirements

### Requirement: 알림 생성 및 저장
IPC를 통해 수신된 알림은 인메모리에 저장되어야 한다(SHALL).

#### Scenario: 알림 생성
- **WHEN** `notification.create` 요청이 `title`, `body`, `level` 파라미터와 함께 수신되면
- **THEN** 고유 ID, timestamp, `read: false` 상태로 알림이 생성되어야 한다
- **THEN** 생성된 알림의 ID를 응답으로 반환해야 한다

#### Scenario: 알림에 터미널 연결
- **WHEN** `notification.create` 요청에 `terminalId` 파라미터가 포함되면
- **THEN** 해당 알림이 지정된 터미널과 연결되어야 한다

#### Scenario: 필수 파라미터 누락
- **WHEN** `title` 없이 `notification.create` 요청이 수신되면
- **THEN** Invalid params 에러를 반환해야 한다

### Requirement: 알림 목록 조회 및 삭제
알림 목록 조회와 삭제 기능을 제공해야 한다(SHALL).

#### Scenario: 전체 알림 목록 조회
- **WHEN** `notification.list` 요청이 수신되면
- **THEN** 모든 알림을 timestamp 역순(최신 순)으로 반환해야 한다

#### Scenario: 특정 알림 삭제
- **WHEN** `notification.clear` 요청에 `id`가 지정되면
- **THEN** 해당 ID의 알림만 삭제해야 한다

#### Scenario: 전체 알림 삭제
- **WHEN** `notification.clear` 요청에 `id`가 없으면
- **THEN** 모든 알림을 삭제해야 한다

### Requirement: StatusBar 배지
미읽은 알림 수를 VS Code 상태바에 표시해야 한다(SHALL).

#### Scenario: 미읽은 알림 존재
- **WHEN** 미읽은 알림이 1개 이상 있을 때
- **THEN** StatusBar에 미읽은 알림 수가 표시되어야 한다
- **THEN** 아이콘이 활성 상태(bell 아이콘)로 표시되어야 한다

#### Scenario: 모든 알림 읽음
- **WHEN** 미읽은 알림이 0개일 때
- **THEN** StatusBar 배지가 숨겨지거나 비활성 상태로 표시되어야 한다

#### Scenario: StatusBar 클릭
- **WHEN** 사용자가 StatusBar 배지를 클릭할 때
- **THEN** Notifications TreeView가 포커스되어야 한다

### Requirement: Notifications TreeView
알림 목록을 사이드바 TreeView로 표시해야 한다(SHALL).

#### Scenario: 알림 목록 표시
- **WHEN** Notifications TreeView가 열려 있을 때
- **THEN** 모든 알림이 timestamp 역순으로 표시되어야 한다
- **THEN** 각 알림에 level에 따른 아이콘(info/warning/error)이 표시되어야 한다

#### Scenario: 알림 클릭 시 터미널 포커스
- **WHEN** 터미널이 연결된 알림을 클릭할 때
- **THEN** 해당 터미널로 포커스가 이동해야 한다
- **THEN** 해당 알림이 `read: true`로 변경되어야 한다

#### Scenario: 알림 클릭 시 터미널 없음
- **WHEN** 터미널이 연결되지 않은 알림을 클릭할 때
- **THEN** 해당 알림이 `read: true`로 변경되어야 한다

### Requirement: 알림 점프 단축키
키보드 단축키로 최신 미읽은 알림으로 이동할 수 있어야 한다(SHALL).

#### Scenario: 미읽은 알림이 있을 때 단축키 실행
- **WHEN** `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` (Windows/Linux)를 누를 때
- **THEN** 가장 최근 미읽은 알림의 연결된 터미널로 포커스가 이동해야 한다
- **THEN** 해당 알림이 `read: true`로 변경되어야 한다

#### Scenario: 미읽은 알림이 없을 때 단축키 실행
- **WHEN** 미읽은 알림이 없는 상태에서 단축키를 누를 때
- **THEN** "미읽은 알림이 없습니다" 메시지가 표시되어야 한다

### Requirement: 시스템 알림 연동
새 알림 수신 시 OS 시스템 알림을 표시할 수 있어야 한다(SHALL).

#### Scenario: 시스템 알림 활성화 상태
- **WHEN** 새 알림이 수신되고 설정 `cmux.systemNotifications`가 `true`일 때
- **THEN** `vscode.window.showInformationMessage()` (또는 level에 따라 warning/error)가 호출되어야 한다

#### Scenario: 시스템 알림 비활성화 상태
- **WHEN** 새 알림이 수신되고 설정 `cmux.systemNotifications`가 `false`일 때
- **THEN** VS Code 메시지 팝업이 표시되지 않아야 한다(MUST NOT)
- **THEN** TreeView와 StatusBar는 정상 업데이트되어야 한다
