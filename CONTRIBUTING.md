# 기여 가이드

vmux 프로젝트에 기여해 주셔서 감사합니다.

## 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/roboco-io/tools.git
cd tools/vmux

# 의존성 설치
npm install

# 빌드
npm run build

# 개발 모드 (파일 변경 감지 + 자동 재빌드)
npm run watch
```

VS Code에서 `F5`를 눌러 Extension Development Host를 실행할 수 있습니다.

## 프로젝트 구조

```
src/
├── extension/   # VS Code 확장 호스트 코드 (IPC 서버, 알림, 세션, 터미널 관리)
├── cli/         # vmux CLI (에이전트가 확장과 통신하는 도구)
├── mcp/         # MCP 서버 (선택적 통합)
├── shared/      # 공유 타입, 프로토콜 정의, 유틸리티
└── test/        # 단위 테스트 및 E2E 테스트
```

## 코드 스타일

- **TypeScript strict 모드** 사용 (`tsconfig.json`의 `strict: true`)
- **esbuild**로 번들링 — CommonJS 출력
- 린트/포맷 설정이 있다면 커밋 전 `npm run lint`를 실행해 주세요

## 테스트

```bash
# 단위 테스트
npm test

# E2E 테스트 (VS Code Extension Test Runner)
npm run test:e2e
```

PR을 보내기 전에 반드시 테스트가 통과하는지 확인해 주세요.

## PR 프로세스

1. 저장소를 **Fork** 합니다.
2. 기능 또는 수정 사항에 맞는 **브랜치**를 생성합니다. (`feat/알림-개선`, `fix/소켓-연결-오류` 등)
3. 변경 사항을 커밋하고 Fork한 저장소에 push 합니다.
4. 원본 저장소에 **Pull Request**를 생성합니다.

## 커밋 메시지 규칙

[Conventional Commits](https://www.conventionalcommits.org/) 스타일을 따릅니다.

```
<type>(<scope>): <description>

[optional body]
```

**타입 예시:**

| 타입 | 설명 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `refactor` | 리팩토링 (기능 변화 없음) |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정 등 기타 작업 |

**예시:**

```
feat(notification): 알림 배지 클릭 시 사이드바 포커스
fix(ipc): Unix 소켓 연결 타임아웃 처리
docs: CONTRIBUTING.md 추가
```
