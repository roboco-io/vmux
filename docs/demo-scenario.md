# vmux MCP Demo Scenario

이 문서는 Claude Code가 vmux MCP 도구를 사용해 실행할 수 있는 데모 시나리오입니다.

> **사전 조건**: vmux 확장이 VS Code에 설치/활성화되어 있고, `.mcp.json`에 vmux MCP 서버가 설정되어 `VMUX_SOCKET`이 연결된 상태여야 합니다.

---

## Scenario 1: 에이전트 작업 시뮬레이션

AI 에이전트가 코드 분석 → 빌드 → 테스트 → 배포하는 전체 워크플로우를 시뮬레이션합니다.

### 단계

1. **알림**: `create_notification(title="Agent", body="작업을 시작합니다", level="info")`
2. **터미널 생성**: `create_terminal(name="agent-worker", cwd="/tmp")`
3. **상태 설정**: `set_status(terminalId="agent-worker", key="state", value="running", icon="play")`
4. **진행률 0%**: `set_progress(terminalId="agent-worker", value=0, label="코드 분석 중...")`
5. **명령 실행**: `send_command(name="agent-worker", text="echo 'Analyzing 42 files...'")`
6. **진행률 25%**: `set_progress(terminalId="agent-worker", value=0.25, label="빌드 중...")`
7. **명령 실행**: `send_command(name="agent-worker", text="echo 'Build successful'")`
8. **진행률 50%**: `set_progress(terminalId="agent-worker", value=0.5, label="테스트 실행 중...")`
9. **명령 실행**: `send_command(name="agent-worker", text="echo '24/24 tests passed'")`
10. **진행률 75%**: `set_progress(terminalId="agent-worker", value=0.75, label="배포 중...")`
11. **명령 실행**: `send_command(name="agent-worker", text="echo 'Deployed to staging'")`
12. **진행률 100%**: `set_progress(terminalId="agent-worker", value=1, label="완료!")`
13. **상태 완료**: `set_status(terminalId="agent-worker", key="state", value="done", icon="check")`
14. **완료 알림**: `create_notification(title="Agent", body="모든 작업이 완료되었습니다", level="info")`

### 확인 포인트
- Metadata TreeView: progress bar가 0% → 25% → 50% → 75% → 100%로 변화
- 100%에서 스피너 아이콘이 체크마크로 변경
- StatusBar에 알림 배지 표시
- 터미널에 echo 출력 표시

### 정리
- `close_terminal(name="agent-worker")`
- `clear_notifications()`

---

## Scenario 2: 에러 핸들링

빌드 실패 시 에이전트가 에러를 보고하는 시나리오입니다.

### 단계

1. **터미널 생성**: `create_terminal(name="build-agent")`
2. **상태 설정**: `set_status(terminalId="build-agent", key="build", value="running", icon="loading~spin")`
3. **진행률 30%**: `set_progress(terminalId="build-agent", value=0.3, label="컴파일 중...")`
4. **명령 실행**: `send_command(name="build-agent", text="echo 'ERROR: Cannot find module ./missing'")`
5. **상태 실패**: `set_status(terminalId="build-agent", key="build", value="FAILED", icon="error")`
6. **에러 알림**: `create_notification(title="Build Failed", body="Cannot find module ./missing", level="error")`
7. **경고 알림**: `create_notification(title="CI Pipeline", body="빌드 실패로 배포가 중단되었습니다", level="warning")`

### 확인 포인트
- Metadata TreeView: build 상태가 error 아이콘으로 표시
- VS Code 팝업에 에러 메시지 표시
- Notifications TreeView에 error/warning 알림 표시

### 정리
- `close_terminal(name="build-agent")`
- `clear_notifications()`

---

## Scenario 3: 다중 터미널 관리

여러 터미널을 생성하고 세션으로 저장/복원하는 시나리오입니다.

### 단계

1. **터미널 3개 생성**:
   - `create_terminal(name="frontend", cwd="/tmp")`
   - `create_terminal(name="backend", cwd="/tmp")`
   - `create_terminal(name="database", cwd="/tmp")`
2. **각 터미널에 명령 전송**:
   - `send_command(name="frontend", text="echo 'React dev server started on :3000'")`
   - `send_command(name="backend", text="echo 'API server started on :8080'")`
   - `send_command(name="database", text="echo 'PostgreSQL connected on :5432'")`
3. **각 터미널 상태 설정**:
   - `set_status(terminalId="frontend", key="port", value=":3000", icon="globe")`
   - `set_status(terminalId="backend", key="port", value=":8080", icon="server")`
   - `set_status(terminalId="database", key="port", value=":5432", icon="database")`
4. **터미널 목록 확인**: `list_terminals()`
5. **포커스 이동**: `focus_terminal(name="backend")`
6. **알림**: `create_notification(title="Dev Environment", body="3개 서비스 실행 중", level="info")`

### 확인 포인트
- Terminals TreeView에 3개 터미널 표시
- Metadata TreeView에 각 터미널의 상태 pill 표시
- 포커스 이동 시 해당 터미널 활성화

### 정리
- `close_terminal(name="frontend")`
- `close_terminal(name="backend")`
- `close_terminal(name="database")`
- `clear_notifications()`

---

## Scenario 4: 알림 우선순위

다양한 레벨의 알림을 보내 TreeView 표시를 확인합니다.

### 단계

1. `create_notification(title="Info", body="일반 정보 메시지", level="info")`
2. `create_notification(title="Warning", body="디스크 사용량 85%", level="warning")`
3. `create_notification(title="Error", body="데이터베이스 연결 실패", level="error")`
4. `create_notification(title="Info", body="백업 완료", level="info")`
5. `create_notification(title="Error", body="메모리 부족", level="error")`
6. **목록 확인**: `list_notifications()`

### 확인 포인트
- Notifications TreeView에 5개 알림 (최신순)
- 각 알림에 level별 아이콘 (info/warning/error)
- StatusBar 배지: 🔔 5
- `Cmd+Shift+U`로 최신 알림 점프

### 정리
- `clear_notifications()`
