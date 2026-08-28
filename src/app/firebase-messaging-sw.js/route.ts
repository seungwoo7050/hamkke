// Next.js는 public/ 정적 파일에 빌드타임 env를 주입할 수 없고, 서비스워커는
// 루트 스코프("/")로 서빙돼야 site-wide push를 받을 수 있다. 그래서 이 파일을
// public/ 대신 라우트 핸들러로 만들어 /firebase-messaging-sw.js 경로에 직접
// 응답한다 — env는 여기서 request 시점에 주입한다.
export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // 서비스워커는 ES 모듈 import를 못 쓰므로(Next.js public 폴더 서빙 방식과도
  // 무관하게 SW 명세 자체의 제약) compat 빌드를 importScripts로 불러온다.
  const body = `importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

// 앱이 백그라운드(탭 비활성/닫힘)일 때만 여기로 온다 — 포그라운드는
// src/lib/firebase-client.ts의 onForegroundMessage가 처리한다.
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || "Hamkke", {
    body: notification.body,
  });
});
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-cache",
    },
  });
}
