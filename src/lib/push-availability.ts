// 이 기기에서 알림을 어떻게 켤 수 있는지(설정 시트의 알림 줄). 브라우저 API를 읽는
// 부분(readPushEnv)과 판정(pushAvailability)을 나눠 판정만 단위 테스트한다.
//
// - native: Android 앱 - 네이티브 권한 대화상자를 앱이 열 때 묻는다(push-native.ts)
// - homeScreen: 아이폰 Safari - 웹 푸시는 홈 화면에 추가한 웹 앱에서만 된다(iOS 16.4+)
// - unsupported: 알림 API나 서비스워커가 없는 브라우저
// - default·granted·denied: 브라우저의 알림 권한 그대로
export type PushAvailability =
  "native" | "homeScreen" | "unsupported" | "default" | "granted" | "denied";

export type PushEnv = {
  native: boolean;
  hasNotification: boolean;
  hasServiceWorker: boolean;
  permission: NotificationPermission | null;
  ios: boolean;
  standalone: boolean;
};

export function pushAvailability(env: PushEnv): PushAvailability {
  if (env.native) return "native";
  if (!env.hasNotification || !env.hasServiceWorker || !env.permission) {
    return env.ios && !env.standalone ? "homeScreen" : "unsupported";
  }
  return env.permission;
}

// iPadOS는 데스크톱 Safari처럼 "Macintosh"로 자신을 밝혀서 터치 지점 수로 가린다.
export function isIosDevice(userAgent: string, maxTouchPoints: number) {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function readPushEnv(native: boolean): PushEnv {
  const hasNotification = typeof Notification !== "undefined";
  return {
    native,
    hasNotification,
    hasServiceWorker: "serviceWorker" in navigator,
    permission: hasNotification ? Notification.permission : null,
    ios: isIosDevice(navigator.userAgent, navigator.maxTouchPoints),
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}
