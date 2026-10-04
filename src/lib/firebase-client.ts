"use client";

import { getApps, initializeApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

let messagingPromise: Promise<Messaging | null> | null = null;

// Safari 등 일부 브라우저는 FCM 웹 푸시를 지원하지 않으므로 매번 체크한다.
function getMessagingIfSupported() {
  if (!messagingPromise) {
    messagingPromise = isSupported().then((supported) =>
      supported ? getMessaging(getFirebaseApp()) : null,
    );
  }
  return messagingPromise;
}

/**
 * 이미 알림을 허용한 브라우저에서 FCM 토큰을 받는다. 권한을 묻지 않는다 - 권한
 * 요청은 사용자가 버튼을 눌렀을 때만(requestPushPermission). 아이폰은 사용자 동작
 * 밖의 요청을 거절하고, 다른 브라우저도 갑작스러운 요청을 조용히 막는다.
 * 허용 전이거나 브라우저가 지원하지 않으면 null.
 */
export async function getGrantedPushToken(): Promise<string | null> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return null;
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  // register()는 등록을 접수하자마자 돌아온다. 처음 방문이면 서비스워커가 아직
  // 설치 중이라 바로 구독하면 "no active Service Worker"로 실패한다(개발 모드는
  // effect가 두 번 돌아 우연히 가려졌다). 활성화된 등록을 기다렸다가 쓴다.
  const registration = await navigator.serviceWorker.ready;

  return getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

/**
 * 버튼을 눌렀을 때 알림 권한을 묻는다. 클릭 핸들러에서 다른 await보다 먼저 불러야
 * 한다 - 사파리는 그 사이에 사용자 동작이 끝난 것으로 보고 요청을 거절한다.
 */
export function requestPushPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

/** 앱이 포그라운드일 때 도착한 푸시를 처리한다(브라우저 기본 알림은 백그라운드에서만 뜬다). */
export async function onForegroundMessage(callback: (payload: MessagePayload) => void) {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
