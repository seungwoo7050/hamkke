<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-ko-dark.svg">
    <img src="assets/brand/logo-ko.svg" alt="함께 Hamkke" width="220">
  </picture>
</p>

<p align="center"><b>떨어져 있는 두 사람이 서로의 하루에 기대어 지내는 곳.</b><br>장거리 연애 커플을 위한 2인 전용 프라이빗 앱 - 웹과 Android.</p>

<p align="center"><img src="assets/screenshots/screens-light.png" alt="첫 화면, 우리, 대화, 기억 탭" width="860"></p>

초대코드로 연결된 두 사람만 쓴다. 오픈 가입·검색·친구 추천이 없고, 공간 안의 모든 것은 둘에게만 보인다. 흔한 커플 앱을 대신하려는 게 아니라 **시차와 거리**를 중심에 둔다 - 지금 상대가 몇 시인지, 자고 있을지, 얼마나 떨어져 있는지, 다음에 언제 만나는지.

## 함께가 하는 일

화면은 하단 세 탭(**우리 · 대화 · 기억**)과 그 위에 열리는 시트뿐이다. 화면마다 초점은 하나.

**우리** - 두 사람의 지금을 한 장면으로 보여 준다.

- 서로의 현지 시각과 시간대에 따라 바뀌는 하늘 색, 날씨, 수면 추정("자고 있을 시간"), 둘 사이 거리
- 주인공은 **생각하고 있어요** 버튼 하나 - 누르면 상대에게 터치가 가고, 받은 터치는 손글씨로 남는다
- 상황에 맞는 카드 최대 두 장: 오늘의 질문, 다음 만남 D-day, 기념일, 도착한 캡슐, 곧 만나요(가까워지면 장면이 바뀐다)
- 비행기를 타면 그 사람 쪽이 "하늘 위"로 바뀌어 진행과 남은 시간을 보여 준다(탑승권 바코드로 등록, 예정 시각 기준)
- 매일 이어 가는 대화 기록(연속 일수)

**대화** - 텍스트, 사진, **영상**, 음성 메시지. 읽음 표시, 입력 중 표시, 그리고 터치가 대화 흐름 사이에 끼어든다. 둘이 같이 앱을 보고 있으면 알려 준다.

**기억** - 둘이 함께 쌓는 것.

- 다가올: 다음 만남 카운트다운, 비행, 기념일(매년 반복), 공유 캘린더(각자 시간대로 표시), 정한 날에 열리는 캡슐
- 지나온: 사진·영상, 함께한 곳을 모은 만남 지도, 열린 캡슐, 지난 질문과 두 사람의 답

**시트** - 위치(지도, 옵트인 위치 공유, 도착하면 알려 주는 장소)와 설정(위치 공유와 최근 30일 제공 횟수, 언어, 요금제와 사용량, 정책 문서, 로그아웃·탈퇴).

<p align="center"><img src="assets/screenshots/screens-sheets.png" alt="다가올 기억, 위치 시트, 설정 시트" width="660"></p>

**그 밖에**

- **Android 홈 화면 위젯** - 상대의 지금 시각, 시차, 거리, 마지막 터치
- **푸시 알림** - 터치, 새 메시지, 도착, 질문 답변(받는 사람의 언어로). 웹은 설정 시트에서 "켜기"를 눌러야 권한을 묻고, **아이폰은 Safari에서 홈 화면에 추가한 웹 앱에서만** 받는다(iOS 16.4+)
- **한국어와 영어** - 두 사람이 각자 자기 언어를 고른다. 영어 문구는 번역이 아니라 영어로 새로 썼다
- **다크 모드** - 시스템 설정을 따른다

<p align="center"><img src="assets/screenshots/screens-dark.png" alt="다크 모드의 우리, 대화, 기억 탭" width="860"></p>

## 요금제

요금제는 사람이 아니라 **공간 단위**다 - 한 사람이 구독하면 둘 다 혜택을 받는다.

|           | 무료 | 프리미엄  |
| --------- | ---- | --------- |
| 사진·영상 | 30개 | 제한 없음 |
| 예약 캡슐 | 3개  | 제한 없음 |
| 만남 지도 | 20곳 | 제한 없음 |
| 저장 공간 | 1GB  | 20GB      |

**지금은 유료 플랜을 닫아 두었다.** 결제는 다 만들어 두었지만 환경변수 `PREMIUM_OPEN=1`일 때만 결제 버튼이 보인다. 닫혀 있는 동안 무료 한도는 그대로이고 "프리미엄은 곧 열려요"라고 안내한다. 열 때 할 일은 [`docs/OWNER_TASKS.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/OWNER_TASKS.md) 8절.

결제는 웹에서 Stripe로 받는다. Android 앱에서는 Google Play **한국 대체 결제**(대체 결제 전용)를 쓴다 - 앱이 Play의 안내를 보여 주고 거래 토큰을 받은 뒤 같은 Stripe 결제로 가고, 서버가 결제·갱신·환불을 Play에 보고한다. 대체 결제를 쓸 수 없는 앱 사용자에게는 결제 진입을 아예 두지 않는다(앱 밖 결제로 안내하면 안 되므로).

## 개인정보와 위치

- **위치는 동의해야 켜진다.** 위치 공유를 켤 때 위치기반서비스 이용약관 동의를 받는다(위치정보법). 앱이 열려 있을 때만 위치를 보내고 백그라운드 추적은 하지 않는다.
- 상대에게 위치가 간 사실은 자동으로 기록되고(6개월 보관), 30일마다 모아서 알린다. 공유를 끄면 동의가 철회되고 위치와 기록이 지워진다.
- **한 사람이 탈퇴하면 공간이 통째로 지워진다** - 둘이 함께 만든 기록이라 한쪽만 남기지 않는다. 앱 밖에서도 `/account/delete`로 요청할 수 있다.
- 사진·영상·음성은 영구 공개 주소가 없고, 볼 때마다 짧게 유효한 주소로 내준다.
- 정책 문서: `/legal/privacy`(개인정보처리방침), `/legal/terms`(이용약관), `/legal/location`(위치기반서비스 이용약관) - 로그인 없이 열린다.

## 스택

Next.js 16(App Router) 단일 코드베이스 - 별도 백엔드 서버가 없다. 설계 이유는 [`docs/ARCHITECTURE.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/ARCHITECTURE.md).

| 영역      | 쓰는 것                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | tRPC v11 + TanStack Query, Zod. 공간 단위 권한은 `spaceProcedure` 한 곳                                                                           |
| DB        | Postgres(Supabase) + Prisma 7. 모든 테이블 RLS 켜짐, Data API 꺼짐 - 데이터는 서버의 Prisma로만                                                   |
| 인증      | Auth.js - 이메일 매직링크(Resend), Google                                                                                                         |
| 실시간    | Supabase Realtime(Broadcast + Presence), 서명 키를 넣으면 공간 토큰으로 private 채널                                                              |
| 미디어    | Cloudflare R2, 브라우저가 서명된 주소로 직접 업로드 - 사진 10MB, 영상 100MB, 음성 5MB                                                             |
| 푸시      | Firebase Cloud Messaging(웹·Android)                                                                                                              |
| 결제      | Stripe Checkout · Customer Portal · Webhook, Google Play 한국 대체 결제(Play Billing Library 9.1)                                                 |
| UI        | Tailwind CSS v4, shadcn/ui(Radix), Vaul, Sonner, Motion. 토큰은 [`docs/DESIGN.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/DESIGN.md) |
| 지도·날씨 | react-leaflet + OpenStreetMap, Open-Meteo(지금은 API 키 없음 - 유료 플랜을 열 때 상업용 키로)                                                     |
| 비행      | 공항 데이터 번들(mwgg/Airports, MIT), 탑승권 바코드(IATA BCBP) 스캔, 예정 시각 기반 진행·대권 경로 - API 키 없음                                  |
| 언어      | next-intl - 문구는 `messages/ko.json`(기준)·`en.json`. 새 언어는 파일 하나 + `src/i18n/config.ts` 한 줄                                           |
| 모바일    | Capacitor(Android) - 배포된 서버를 웹뷰로 연다. 위젯(Jetpack Glance)과 대체 결제 플러그인만 Kotlin                                                |
| 테스트    | Vitest(단위·통합, 실제 DB·R2·Stripe 테스트 모드), Playwright(e2e)                                                                                 |

## 시작하기

필요한 것: Node 24 · npm 11, Postgres 16(로컬은 Docker).

```bash
npm install
cp .env.example .env          # 키마다 발급 방법이 주석으로 적혀 있다
docker compose up -d          # 로컬 Postgres (postgresql://hamkke:hamkke@localhost:5432/hamkke)
npx prisma migrate deploy     # 스키마 적용
npx prisma generate           # 클라이언트 생성(src/generated/prisma)
npm run dev                   # http://localhost:3000
```

로그인 메일 없이 바로 보려면 페어링된 테스트 커플을 만든다. 출력되는 세션 토큰을 브라우저 쿠키 `authjs.session-token`에 넣으면 된다(로컬 DB에서만 돈다).

```bash
npm run dev:seed-couple
```

지금은 `.env.example`의 키가 **모두** 있어야 앱 전체가 정상으로 뜬다(Stripe·Supabase 클라이언트는 키 없이 초기화하면 실패한다). 개발 중에는 각 서비스의 무료·테스트 모드 키로 충분하다. 개발 중 쿠키 `hamkke-pseudo=1`을 넣으면 가짜 언어로 바뀌어 하드코딩된 문구가 드러난다.

## 스크립트

| 명령                                                          | 내용                                                                                                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                                 | 개발 서버                                                                                                                                                             |
| `npm run build` / `npm start`                                 | 프로덕션 빌드 / 실행                                                                                                                                                  |
| `npm run lint` · `npm run typecheck` · `npm run format:check` | ESLint · 타입 검사 · Prettier                                                                                                                                         |
| `npm test`                                                    | Vitest - 라우터 통합 테스트는 **실제 DB**에 쓰고 지운다(로컬 DB로). R2·Stripe·Realtime 키가 없으면 그 서비스에 실제로 왕복하는 테스트만 건너뛴다                      |
| `npm run test:e2e`                                            | Playwright 핵심 플로우(페어링 → 채팅 → 위치 공유 → 구독)와 영어·가짜 언어 화면(한국어 0자). 서버와 같은 **로컬** `DATABASE_URL`이 필요하고, 원격 DB면 실행을 거부한다 |
| `npm run dev:seed-couple`                                     | 페어링된 개발용 커플 계정                                                                                                                                             |

push마다 GitHub Actions(`.github/workflows/ci.yml`)가 lint·타입 검사·Prettier·Vitest(서비스 컨테이너 Postgres)·빌드를 돌린다. e2e는 Stripe 테스트 모드 시크릿이 있을 때만 돈다(필요한 시크릿은 파일 맨 위 주석).

## Android

```bash
npx cap sync android                          # Cordova 플러그인 폴더 생성(gitignore)
cd android && ./gradlew assembleDebug         # app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest                   # 위젯 문구 단위 테스트
```

앱은 `capacitor.config.ts`의 `server.url`을 웹뷰로 연다(에뮬레이터 개발 기본값 `http://10.0.2.2:3000`, 운영 도메인은 아직 정하지 않았다). 홈 화면 위젯은 같은 주소의 `/api/widget`을 웹뷰 세션 쿠키로 부르므로 별도 토큰이 없다. 한국 대체 결제는 앱 안의 로컬 플러그인(`android/app/src/main/java/com/hamkke/app/billing/AlternativeBillingPlugin.kt`, 웹 쪽은 `src/lib/alternative-billing.ts`)이 맡는다. iOS는 비용 문제로 보류 중이다.

### Android 릴리스 빌드(Play 업로드)

`android/keystore.properties`(gitignore)에 업로드 키의 경로와 비밀번호(`storeFile`, `storePassword`, `keyAlias`, `keyPassword`)가 있으면 release 빌드가 그 키로 서명하고, 없으면 서명 없이 빌드된다. 키를 만들고 보관하는 법은 운영 문서에 있다.

```bash
npx cap sync android
cd android && ./gradlew bundleRelease         # app/build/outputs/bundle/release/app-release.aab
```

## 배포

배포와 운영(Vercel·Supabase·R2·Stripe 대시보드 설정, 스토어 등록, 유료 플랜 열기)은 사람이 따라 하는 절차라 `docs` 브랜치의 [`docs/OWNER_TASKS.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/OWNER_TASKS.md)에 있다. 코드와 관련해 기억할 것은 두 가지다.

- **마이그레이션을 코드보다 먼저** 운영 DB에 적용한다: `DATABASE_URL=<운영 direct 연결> npx prisma migrate deploy`(Supabase는 포트 5432 direct 연결만 쓴다 - `.env.example` 주석).
- 운영에서는 `APP_URL`을 반드시 넣는다. 유료 플랜은 `PREMIUM_OPEN=1`일 때만 열린다.
- `GET /api/health`는 DB까지 닿는지만 보는 헬스 체크다(200 `ok` / 503). 오류는 `NEXT_PUBLIC_SENTRY_DSN`이 있을 때만 Sentry로 간다.

## 폴더

```
src/app/            라우트 - login, onboarding, home(우리·대화·기억 + 시트), legal, account, api(auth·trpc·widget·webhooks·health)
src/server/         tRPC 라우터와 서버 전용 로직(요청 제한, 계정 삭제, 위치 제공 기록, Play 보고)
src/lib/            순수 로직(시간·거리·요금제·상황 카드·비행…)과 외부 서비스 클라이언트
src/components/     ui(shadcn 기반) · brand(심볼·로고·장면 그림)
src/i18n/           언어 설정·해석·포맷터 - 문구는 messages/
src/legal/          정책 문서(개인정보처리방침·이용약관·위치기반서비스 약관)
prisma/             스키마와 마이그레이션
public/             장면 그림(illustrations/)
android/            Capacitor 셸 + 홈 화면 위젯·대체 결제 플러그인(Kotlin)
e2e/                Playwright
scripts/            시드, 공항 데이터 갱신, 운영 점검(R2 CORS·Realtime private)
assets/             브랜드 마스터(로고·심볼·Play 대표 이미지)와 README 스크린샷
```

## 문서

설계 문서와 진행 기록은 고아 브랜치 [`docs`](https://github.com/woopinbell/hamkke/tree/docs)에, 개발 기록은 [`devlog`](https://github.com/woopinbell/hamkke/tree/devlog)에 있다. 로컬에서는 워크트리로 붙여 쓴다.

```bash
git worktree add .docs docs && ln -sfn .docs/CLAUDE.md CLAUDE.md && ln -sfn .docs/docs docs
git worktree add .devlog devlog && ln -sfn .devlog devlog
printf '%s\n' .docs/ .devlog/ CLAUDE.md docs devlog >> .git/info/exclude
```

- [`docs/PRD.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/PRD.md) - 기능 명세·데이터 모델
- [`docs/ARCHITECTURE.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/ARCHITECTURE.md) - 스택·실시간·결제·보안 설계
- [`docs/DESIGN.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/DESIGN.md) - 디자인 철학 앵커와 토큰(임의 변경 금지)
- [`docs/WORKFLOW.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/WORKFLOW.md) · [`docs/COMMIT_PLAN.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/COMMIT_PLAN.md) - 커밋 규칙과 진행 기록
- [`docs/OWNER_TASKS.md`](https://github.com/woopinbell/hamkke/blob/docs/docs/OWNER_TASKS.md) - 배포·운영 절차와 운영자(사람)가 직접 해야 할 일
- [`CLAUDE.md`](https://github.com/woopinbell/hamkke/blob/docs/CLAUDE.md) - 현재 상태와 고정 결정
