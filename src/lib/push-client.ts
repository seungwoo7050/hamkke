"use client";

import { onForegroundMessage, requestPushToken } from "@/lib/firebase-client";
import { isNativePush, onNativeForegroundMessage, requestNativePushToken } from "@/lib/push-native";

/**
 * 웹/네이티브 Android 어느 쪽에서 열렸는지에 따라 올바른 FCM 등록 경로로
 * 위임한다 — 호출하는 쪽(chat-view.tsx)은 플랫폼을 신경 쓰지 않는다.
 */
export async function requestAnyPushToken(): Promise<string | null> {
  return isNativePush() ? requestNativePushToken() : requestPushToken();
}

export async function onAnyForegroundMessage(callback: (body: string) => void) {
  if (isNativePush()) return onNativeForegroundMessage(callback);
  const unsubscribe = await onForegroundMessage((payload) => {
    const body = payload.notification?.body ?? payload.notification?.title;
    if (body) callback(body);
  });
  return unsubscribe;
}
