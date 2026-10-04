"use client";

import { getGrantedPushToken, onForegroundMessage } from "@/lib/firebase-client";
import { isNativePush, onNativeForegroundMessage, requestNativePushToken } from "@/lib/push-native";

/**
 * 앱을 열 때 부른다. 웹/네이티브 Android 어느 쪽에서 열렸는지에 따라 올바른 FCM
 * 등록 경로로 위임한다 - 호출하는 쪽(app-effects.tsx)은 플랫폼을 신경 쓰지 않는다.
 * 네이티브 앱은 시스템 권한 대화상자로 묻고, 웹은 이미 허용한 경우에만 토큰을
 * 받는다(웹에서 권한을 묻는 것은 설정 시트의 "알림 켜기" - notification-section.tsx).
 */
export async function registerAnyPushOnOpen(): Promise<string | null> {
  return isNativePush() ? requestNativePushToken() : getGrantedPushToken();
}

export async function onAnyForegroundMessage(callback: (body: string) => void) {
  if (isNativePush()) return onNativeForegroundMessage(callback);
  const unsubscribe = await onForegroundMessage((payload) => {
    const body = payload.notification?.body ?? payload.notification?.title;
    if (body) callback(body);
  });
  return unsubscribe;
}
