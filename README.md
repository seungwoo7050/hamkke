# Hamkke (함께)

장거리 연애(LDR) 커플을 위한 **2인 전용** 프라이빗 앱 — "거리가 있어도 서로에게 기대어 서 있다."

초대코드로 연결된 두 사람만 쓴다. 오픈 가입·검색·추천이 없다.

<img src="assets/screenshots/ia-implemented.png" alt="우리 · 대화 · 기억 3탭 화면" width="720">

## 무엇을 하나

| 화면         | 내용                                                                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **우리**     | 두 사람의 지금을 한 장면으로 — 서로의 현지 시각(시간대별 하늘 색), 날씨, 수면 추정, 거리. 주인공인 **터치**("생각하고 있어요") 버튼, 마지막으로 받은 터치, 상황 카드(곧 만나요·기념일·도착한 캡슐·하루 한 질문·다음 만남 D-day). 비행 중이면 타는 사람 쪽이 "하늘 위"(진행·남은 시간)로 바뀐다. |
| **대화**     | 텍스트·사진·음성 메시지, 읽음 표시, 타이핑 표시, 터치가 대화 흐름에 끼어듦.                                                                                                                                                                                                                     |
| **기억**     | 다가올(카운트다운·기념일·공유 캘린더·예약 캡슐) / 지나온(사진·만남 지도·열린 캡슐·지난 질문).                                                                                                                                                                                                   |
| 시트         | 위치(지도, 옵트인 위치공유, 도착 알림 장소), 설정(구독·사용량·로그아웃).                                                                                                                                                                                                                        |
| Android 위젯 | 홈 화면에서 상대의 지금 시각·시차·거리·마지막 터치.                                                                                                                                                                                                                                             |

무료 티어가 있고, 프리미엄(스페이스 단위 구독 — 한쪽이 결제하면 둘 다)은 사진·예약 캡슐·만남 지도 한도를 푼다.

## 스택

Next.js 16(App Router) 단일 코드베이스 — 별도 백엔드 없음.

- **API**: tRPC v11 + TanStack Query, Zod
- **DB**: Postgres(Supabase) + Prisma 7
- **인증**: Auth.js — 이메일 매직링크(Resend) · Google
- **실시간**: Supabase Realtime(Broadcast + Presence)
- **미디어**: Cloudflare R2(presigned URL)
- **푸시**: FCM
- **결제**: Stripe Checkout · Customer Portal · Webhook
- **UI**: Tailwind CSS v4, shadcn/ui(Radix), Vaul, Sonner, Motion — 토큰은 [`docs/DESIGN.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/DESIGN.md)
- **지도·날씨**: react-leaflet + OpenStreetMap, Open-Meteo(둘 다 API 키 불필요)
- **비행**: 공항 데이터 번들(mwgg/Airports, MIT — `npx tsx scripts/build-airports.mts`로 갱신), 예정 시각 기반 진행·대권 추정 위치, 탑승권 바코드(IATA BCBP) 스캔 — API 키 없음
- **모바일**: Capacitor(Android) — 배포된 서버를 웹뷰로 원격 로드, 위젯만 Kotlin(Jetpack Glance)
- **언어**: next-intl — 한국어 기본 + 영어, 사람마다 자기 언어(설정 시트). 문구는 `messages/ko.json`(기준)·`en.json`, 새 언어는 파일 하나 + `src/i18n/config.ts` 한 줄. 개발 중 쿠키 `hamkke-pseudo=1`이면 가짜 언어로 하드코딩 문구가 드러난다
- **테스트**: Vitest(단위·통합, 실제 DB), Playwright(e2e)

설계 이유는 [`docs/ARCHITECTURE.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/ARCHITECTURE.md).

## 시작하기

필요한 것: Node 24 · npm 11, Postgres 16(로컬은 Docker).

```bash
npm install
cp .env.example .env          # 각 키 발급 방법이 주석으로 적혀 있다
docker compose up -d          # 로컬 Postgres (postgresql://hamkke:hamkke@localhost:5432/hamkke)
npx prisma migrate deploy     # 스키마 적용
npx prisma generate           # 클라이언트 생성(src/generated/prisma)
npm run dev                   # http://localhost:3000
```

로그인 메일 없이 바로 보려면 페어링된 테스트 커플을 만든다. 출력되는 세션 토큰을 브라우저 쿠키 `authjs.session-token`에 넣으면 된다.

```bash
npm run dev:seed-couple
```

지금은 `.env.example`의 키가 **모두** 있어야 앱 전체가 정상으로 뜬다. Stripe·Supabase 클라이언트는 키 없이 초기화하면 실패한다. 개발 중에는 각 서비스의 무료·테스트 모드 키로 충분하다.

## 스크립트

| 명령                                                          | 내용                                                                                                                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                                 | 개발 서버                                                                                                                                                            |
| `npm run build` / `npm start`                                 | 프로덕션 빌드 / 실행                                                                                                                                                 |
| `npm run lint` · `npm run typecheck` · `npm run format:check` | ESLint · 타입 검사 · Prettier                                                                                                                                        |
| `npm test`                                                    | Vitest — 라우터 통합 테스트는 **실제 DB**에 쓰고 지운다(로컬 DB로)                                                                                                   |
| `npm run test:e2e`                                            | Playwright 핵심 플로우(페어링 → 채팅 → 위치공유 → 구독)와 영어·가짜 언어 화면(한국어 0자). 서버와 같은 **로컬** `DATABASE_URL`이 필요하고, 원격 DB면 실행을 거부한다 |
| `npm run dev:seed-couple`                                     | 페어링된 개발용 커플 계정                                                                                                                                            |

## Android

```bash
npx cap sync android                          # Cordova 플러그인 폴더 생성(gitignore)
cd android && ./gradlew assembleDebug         # app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest                   # 위젯 문구 단위 테스트
```

앱은 `capacitor.config.ts`의 `server.url`을 웹뷰로 연다(에뮬레이터 개발 기본값 `http://10.0.2.2:3000`). 홈 화면 위젯은 같은 주소의 `/api/widget`을 웹뷰 세션 쿠키로 부르므로 별도 토큰이 없다. iOS는 비용 문제로 보류 중이다.

## 배포 체크리스트

1. Vercel에 배포하고 `.env.example`의 값을 환경변수로 넣는다.
2. 운영 DB에 마이그레이션: `DATABASE_URL=<운영 direct 연결> npx prisma migrate deploy`(Supabase는 포트 5432 direct 연결만 쓴다 — `.env.example` 주석 참고).
3. Stripe 대시보드 → Webhooks에 `https://<도메인>/api/webhooks/stripe`(`customer.subscription.*`)를 등록하고 `STRIPE_WEBHOOK_SECRET`을 교체한다.
4. Google OAuth 리디렉션 URI와 Resend 발신 도메인을 운영 도메인으로 바꾼다.
5. `capacitor.config.ts`의 `server.url`을 운영 도메인(https)으로 바꾸고 `cleartext`를 끈 뒤 Android를 다시 빌드한다.
6. Cloudflare 대시보드 → R2 → 버킷 → Settings → Object lifecycle rules에 **접두사 `pending/`, 업로드 1일 뒤 삭제** 규칙을 추가한다. 업로드 주소만 받고 등록하지 않은 파일이 여기서 지워진다(앱의 R2 키는 버킷 설정 권한이 없어 코드로 넣지 않는다).
7. Google Play Console → 앱 콘텐츠 → 데이터 보안의 계정 삭제 URL에 `https://<도메인>/account/delete`를 등록한다(앱 밖에서도 삭제를 요청할 수 있어야 한다는 Play 요건).
8. **Realtime private 채널 전환**(ARCHITECTURE §4) — 이 순서대로(중간에 멈춰도 실시간 기능은 계속 동작한다):
   1. 운영 DB에 마이그레이션(2번)으로 `realtime_space_policies` 정책이 들어갔는지 확인한다.
   2. `npx tsx scripts/generate-supabase-jwt-key.mts`로 키를 만들고, Supabase → Project Settings → JWT Keys에서 출력된 JWK를 **standby 키로 가져온 뒤 Rotate로 current**로 바꾼다(Supabase Auth는 쓰지 않아 영향 없음).
   3. 배포 환경변수 `SUPABASE_JWT_PRIVATE_KEY`에 같은 JWK 한 줄을 넣고 다시 배포한다 — 이때부터 앱이 private 채널을 쓴다.
   4. Supabase → Realtime → Settings에서 **Allow public access를 끈다**.
   5. `npx tsx --conditions=react-server scripts/check-realtime-private.mts`가 "전부 통과"인지 확인한다.
   6. 같은 화면에서 Realtime 초당 이벤트 한도를 확인하고, 프로젝트 spend cap을 켜 둔다.
9. **청구 알림·지출 상한** — 앱의 요청 횟수 제한·저장 용량 상한(ARCHITECTURE §7)이 1차 방어이고, 이건 코드 밖에서 새는 것까지 묶는 2차 방어다(2026-09-30 각 서비스 문서로 확인).
   - **Vercel**: 구독 결제가 있는 앱은 상업 이용이라 **Hobby 플랜으로는 운영할 수 없다**(Pro 이상). Settings → Billing → Spend Management를 켜고 On-Demand Budget을 정한 뒤 **Pause Production Deployments**를 켠다 — 금액만 정하면 알림만 오고 사용은 멈추지 않는다. 확인이 몇 분 간격이라 넘은 뒤에도 몇 분은 과금되니 예산을 여유 있게 낮게 잡는다. 멈추면 프로젝트마다 직접 다시 켜야 한다.
   - **Supabase**: Pro 플랜의 **Spend Cap을 켠 채로** 둔다 — 켜 두면 할당량을 넘은 항목은 다음 결제 주기까지 막히고 초과 요금이 없다. Compute·디스크·커스텀 도메인 같은 애드온은 Spend Cap에 포함되지 않으니 켜기 전에 확인한다. Realtime 초당 이벤트 한도는 8번에서 확인.
   - **Cloudflare(R2)**: Billing → Budget alerts로 계정 전체 금액 알림을 걸고, Notifications에 R2 사용량(저장량·요청 수) 알림을 추가한다. 무료 범위는 저장 10GB·Class A 요청 월 100만 회 — 그 10% 정도에 첫 알림을 두면 이상 징후를 일찍 본다.
   - **Resend**: 무료 플랜은 하루 100통·월 3,000통이고 넘으면 발송이 멈춘다(= 로그인 메일이 안 나감). 유료 플랜은 초과분이 과금되며 월 할당량의 5배에서 멈춘다. 앱은 이메일당 15분 3회·IP당 1시간 10회로 막지만(ARCHITECTURE §7), 대시보드의 사용량 알림도 켜 둔다.
   - **Stripe**: Radar 요금제를 확인한다 — 카드 테스팅(훔친 카드를 빠르게 시험하는 결제) 방지와 사기 알림은 가장 낮은 Lite에도 있고, Standard 이상은 검사한 결제마다 수수료가 붙으며 직접 규칙을 쓰려면 Plus가 필요하다. 구독은 갱신 결제를 몇 번까지 검사할지 대시보드에서 줄여 수수료를 아낄 수 있다. 분쟁(chargeback)은 건당 수수료가 붙으니 분쟁 알림 이메일을 켠다. 앱은 결제 화면 생성을 사용자당 1시간 10회로 막는다.
10. **상업 라이선스 — 출시 전에 결정 필요**(사용자 결정 대기, 비용 발생)
    - **날씨(Open-Meteo)**: 무료 API는 비상업 용도만 허용하고, 약관이 "구독이나 광고가 있는 앱"을 상업 용도로 명시한다 — 출시 전에 유료 API 플랜에 가입해야 한다. 가입하면 API 키와 전용 주소를 `src/lib/weather.ts`의 호출에 붙이는 작은 코드 변경이 필요하다(서버 캐싱을 함께 넣으면 호출 수도 줄어든다).
    - **지도 타일(tile.openstreetmap.org)**: 사용 정책상 상업 서비스는 "언제든 예고 없이 접근이 막힐 수 있다"고 경고하고, 오프라인 저장은 금지다(Hamkke는 오프라인 저장을 하지 않고 출처 표기도 지도마다 보인다). 막히면 지도 3곳(위치·만남 지도·비행 경로)이 비게 되니, 출시 전에 상용 타일 제공자(MapTiler·Stadia Maps 등)로 바꾸거나 Protomaps처럼 타일 파일을 R2에 직접 올려 쓰는 방식을 정한다. 바꾸는 코드는 `TileLayer`의 URL과 출처 문구뿐이다.

## 폴더

```
src/app/            라우트 — login, onboarding, home(우리·대화·기억 3탭 + 시트), api(auth·trpc·widget·webhooks)
src/server/trpc/    tRPC 라우터(스페이스 단위 권한은 spaceProcedure 한 곳)
src/lib/            순수 로직(시간·거리·요금제·상황 카드…)과 외부 서비스 클라이언트
src/components/     ui(shadcn 기반) · brand(심볼·모티프)
src/i18n/           언어 설정·해석·포맷터 — 문구는 messages/
prisma/             스키마와 마이그레이션
android/            Capacitor 셸 + 홈 화면 위젯(Kotlin)
e2e/                Playwright
assets/             브랜드 마스터 SVG·README 스크린샷
```

## 문서

설계 문서와 진행 기록은 고아 브랜치 [`docs`](https://github.com/woopinbell/hamkke/tree/docs)에, 개발 기록은 [`devlog`](https://github.com/woopinbell/hamkke/tree/devlog)에 있다. 로컬에서는 워크트리로 붙여 쓴다.

```bash
git worktree add .docs docs && ln -sfn .docs/CLAUDE.md CLAUDE.md && ln -sfn .docs/docs docs
git worktree add .devlog devlog && ln -sfn .devlog devlog
printf '%s\n' .docs/ .devlog/ CLAUDE.md docs devlog >> .git/info/exclude
```

- [`docs/PRD.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/PRD.md) — 기능 명세·데이터 모델
- [`docs/ARCHITECTURE.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/ARCHITECTURE.md) — 스택·실시간·결제·보안 설계
- [`docs/DESIGN.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/DESIGN.md) — 디자인 철학 앵커와 토큰(임의 변경 금지)
- [`docs/WORKFLOW.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/WORKFLOW.md) · [`docs/COMMIT_PLAN.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/COMMIT_PLAN.md) — 커밋 규칙과 진행 기록
- [`CLAUDE.md`](https://github.com/woopinbell/hamkke/blob/docs/CLAUDE.md) — 현재 상태와 고정 결정
