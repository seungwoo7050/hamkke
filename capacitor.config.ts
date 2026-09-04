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

export default config;
