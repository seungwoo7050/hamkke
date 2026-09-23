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

  // 이 본문은 번들을 거치지 않는 문자열이라 npm 패키지를 import할 수 없다.
  // Firebase 문서의 웹 푸시 예시대로 compat 빌드를 importScripts로 불러온다.
  const body = `importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

// 앱이 백그라운드(탭 비활성/닫힘)일 때만 여기로 온다 — 포그라운드는
// src/lib/firebase-client.ts의 onForegroundMessage가 처리한다.
// notification 필드가 있는 메시지는 SDK가 이 핸들러를 부르기 전에 이미 알림을
// 띄운다. 여기서 또 띄우면 같은 알림이 두 번 뜨므로 data 전용 메시지만 직접 띄운다.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const data = payload.data || {};
  if (!data.title && !data.body) return;
  self.registration.showNotification(data.title || "Hamkke", { body: data.body });
});
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-cache",
    },
  });
}
