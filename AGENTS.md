<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

hamkke(함께): 장거리·일상 커플을 위한 2인 전용 공간(Next.js 16 App Router + tRPC v11 + Prisma 7 + Postgres).

## 명령

| 할 일 | 명령 |
| --- | --- |
| 의존성 | `npm ci` |
| 개발 DB(Postgres 16, 5432) | `docker compose up -d` |
| 빠른 검사(끝내기 전 필수, Stop 훅이 강제) | `npm run verify:fast` |
| 전체 검사(브랜치를 끝낼 때) | `npm run verify` |
| 개발 서버 | `npm run dev` (3000) |
| 새 마이그레이션 | `npx prisma migrate dev --create-only --name <이름>` |

- `verify:fast` = prisma generate + lint + typecheck + format:check + prisma migrate deploy + test:unit + test:harness
- `verify` = fast + test:e2e. 결과는 마지막 한 줄 `verify(full): …`, 단계별 로그는 `.harness/logs/`
- `verify` 전제: 로컬 Postgres(5432)가 떠 있다. 웹 e2e는 `scripts/harness/with-e2e.sh`가 3000 포트 점유를 확인하고, Stripe 키가 없으면 `scripts/stripe-sim.mjs`(4100)를 테스트 대역으로 띄워 구독 시나리오까지 건너뛰지 않고 돌린다
- 3000을 다른 체크아웃(worktree)의 서버가 쥐고 있으면 웹 e2e가 멈춘다. 그 서버를 내리거나 사람에게 알린다
- CI(`.github/workflows/ci.yml`)도 같은 npm 스크립트를 부른다. 검사를 바꾸면 npm 스크립트를 바꾼다

## 금지 (훅이 막는다: `scripts/harness/guard.sh`)

- `.env`, `.env.*` 편집(`.env.example`은 된다). 새 값이 필요하면 `.env.example`에 이름만 더하고 보고한다
- `git push`. 로컬 커밋까지만 한다
- `rm -r`로 저장소 밖, `/`, 저장소 루트 지우기. 변수를 펼치지 않은 대상도 막는다
- 이미 있는 `prisma/migrations/*` 수정. 바꿀 내용은 새 마이그레이션으로 만든다

## 훅 (`.claude/settings.json`)

- PreToolUse → `guard.sh`: 위 금지를 exit 2와 이유로 돌려보낸다
- PostToolUse → `lint-file.sh`: 쓴 파일을 eslint(`--max-warnings 0`)로 본다. 오류·경고가 보이면 바로 고친다
- Stop → `stop-verify.sh`: `verify:fast`가 실패하면 끝내기를 막고 요약을 준다. 연달아 3번 막히면 고치지 못한 실패로 보고한다
- 가드를 바꾸면 `scripts/harness/*.test.sh`에 막을 예와 통과할 예를 같이 더한다

## 작업 규칙

- 커밋은 작은 단위로. 메시지는 `feat(…): …`, `refactor(…): …`, `chore(…): …` 꼴, 한국어 본문
- 테스트 수를 줄이지 않는다. 깨진 테스트는 고치거나 이유를 보고한다
- 디자인·프라이버시 불변식(`scripts/harness/design-guard.sh`): AI 슬롭 그라데이션·보라색 클래스 금지, 인터랙티브 요소에 `font-handwritten` 금지, Sentry `beforeSend: scrubEvent` 및 `sendDefaultPii: false` 유지
- 영어·의사로케일(`en`, `pseudo`) 화면에 한글 글자가 남지 않아야 한다(`e2e/i18n.spec.ts`)
