"use client";

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

/**
 * 네이티브 Android 앱(server.url로 웹뷰에 로드된 동일한 React 코드) 안에서는
 * 브라우저 Notification API 대신 Capacitor의 네이티브 FCM 브리지를 써야
 * 실제 기기 토큰을 받을 수 있다(src/lib/firebase-client.ts의 웹 경로는
 * 웹뷰 안에서 동작하지 않는다). 서버 쪽(src/lib/push.ts)은 토큰 출처를
 * 구분하지 않고 그대로 FCM에 보내므로 여기서 얻은 토큰도 동일하게 동작한다.
 */
export function isNativePush() {
  return Capacitor.isNativePlatform();
}

export async function requestNativePushToken(): Promise<string | null> {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return null;

  // 이번 요청에 붙인 리스너는 결과를 받으면 뗀다 — 떼지 않으면 앱 화면이 다시
  // 마운트될 때마다 registration 리스너가 하나씩 쌓인다.
  const handles: PluginListenerHandle[] = [];
  try {
    return await new Promise<string | null>((resolve) => {
      void Promise.all([
        PushNotifications.addListener("registration", (token) => resolve(token.value)),
        PushNotifications.addListener("registrationError", () => resolve(null)),
      ]).then((added) => {
        handles.push(...added);
        return PushNotifications.register();
      });
    });
  } finally {
    await Promise.all(handles.map((handle) => handle.remove()));
  }
}

/** 앱이 포그라운드일 때 도착한 푸시를 처리한다(웹 경로의 onForegroundMessage와 동일한 역할). */
export async function onNativeForegroundMessage(callback: (body: string) => void) {
  const handle = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const body = notification.body ?? notification.title;
    if (body) callback(body);
  });
  return () => handle.remove();
}
