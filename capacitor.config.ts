import type { CapacitorConfig } from "@capacitor/cli";

// Hamkke는 App Router 서버 컴포넌트/Server Actions/tRPC/Auth.js 세션
// 쿠키/Stripe 웹훅을 쓰는 완전한 SSR 앱이라 정적 export가 불가능하다
// (docs/ARCHITECTURE.md §2 "별도 백엔드 없이 Next.js 단일 코드베이스"
// 원칙의 직접적 귀결). 그래서 webDir을 번들하는 대신 server.url로 실제
// Next.js 서버를 웹뷰에서 원격 로드한다 — capacitor-shell/index.html은
// server.url 로딩 실패 시에만 잠깐 보이는 로컬 폴백일 뿐이다.
//
// 지금은 로컬 개발 서버를 가리킨다: 10.0.2.2는 Android 에뮬레이터에서
// 호스트 macOS의 localhost를 가리키는 표준 별칭이다. 실제 기기로 테스트할
// 때는 이 값을 Mac의 LAN IP(예: 192.168.x.x:3000)로 바꿔야 한다. 배포
// 후에는 실제 프로덕션 도메인(https://...)으로 교체한다(Phase 8).
const config: CapacitorConfig = {
  appId: "com.hamkke.app",
  appName: "Hamkke",
  webDir: "capacitor-shell",
  server: {
    url: "http://10.0.2.2:3000",
    cleartext: true,
  },
};

// 2026-09-26: useLegacyBridge/CapacitorHttp.enabled는 원래
// @capacitor-community/background-geolocation의 "5분 뒤 백그라운드 콜백
// 끊김" 문제를 막으려고 추가했었다. 하지만 실기기 검증 중 이 플러그인이
// ACCESS_BACKGROUND_LOCATION을 요청하지 않아 Android 14+에서 백그라운드
// 진입 시 위치 서비스 승격이 조용히 실패하는 걸 발견해, 위치공유 범위를
// 포그라운드 전용으로 낮췄다(src/lib/location-native.ts 각주 참고) — 그래서
// "백그라운드 5분" 문제 자체가 더 이상 해당하지 않아 두 설정을 되돌렸다.
// (하이드레이션 문제와는 무관함을 별도로 확인했었다 — 아래 각주 참고.)

// 2026-09-26 디버깅 메모: 이 에뮬레이터+dev 서버(Turbopack HMR websocket)
// 조합에서는 React가 전혀 hydrate되지 않아(클릭 리스너 0개) 버튼 클릭이
// 하나도 동작하지 않는 현상을 발견했다 — ws://.../_next/hmr 핸드셰이크가
// 에뮬레이터 NAT를 통과하며 계속 실패하는 게 원인으로 보인다(useLegacyBridge
// /CapacitorHttp를 꺼도 재현되므로 이 설정과는 무관함을 확인). `next build`
// + `next start`로 만든 프로덕션 빌드를 가리키면 정상적으로 hydrate되고
// 클릭 이벤트가 붙는 것까지 실제로 확인했다 — 즉 실제 배포본은 문제없고,
// 이 로컬 dev 서버 조합에서만 리액트 상호작용을 눈으로 확인할 수 없다.
// 이후 세션에서 네이티브 화면의 실제 클릭/폼 상호작용을 검증해야 한다면
// 이 dev 서버 대신 프로덕션 빌드를 가리키거나 실제 기기로 테스트할 것.

export default config;
