"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativePosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface WatcherError {
  code: string;
  message: string;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    // backgroundTitle/backgroundMessage는 의도적으로 쓰지 않는다 -
    // startNativeLocationWatch의 주석 참고.
    options: {
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (position: NativePosition | undefined, error: WatcherError | undefined) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

// 시작 중인 감시까지 기억한다. addWatcher는 비동기라 끝나기 전에 멈추라는 요청이
// 올 수 있고(화면이 곧바로 내려가거나 개발 모드에서 effect가 두 번 돌 때), 그때
// id만 기억하면 아직 비어 있어 아무것도 멈추지 못한다.
let watcher: Promise<string> | null = null;

export function isNativeLocation() {
  return Capacitor.isNativePlatform();
}

/**
 * 실기기 검증(2026-09-26) 중 발견: 이 플러그인은 ACCESS_FINE/COARSE_LOCATION만
 * 요청하고 ACCESS_BACKGROUND_LOCATION은 요청하지 않는다. Android 14+에서는
 * 앱이 백그라운드로 간 뒤 foregroundServiceType="location" 서비스를
 * 승격하려면 이 권한이 필요해서, backgroundTitle/backgroundMessage를 채워
 * "진짜" 백그라운드 추적을 시도하면 서비스 승격이 조용히 실패한다(로그만
 * 남고 알림은 안 뜸). 그래서 범위를 포그라운드 전용으로 낮췄다 - 이 두
 * 옵션을 비워두면 플러그인이 애초에 포그라운드 서비스 승격을 시도하지
 * 않는다(공식 문서: backgroundMessage가 없으면 위치 갱신은 포그라운드에서만
 * 보장됨). distanceFilter(이동 거리 기준)로 배터리 소모를 최소화한다.
 * ACCESS_BACKGROUND_LOCATION 지원(Play 배경위치 사용목적 선언 필요)은
 * 실제로 필요해지면 별도 세션에서 재검토한다.
 */
export async function startNativeLocationWatch(
  onPosition: (position: { lat: number; lng: number; accuracy: number }) => void,
  onError: () => void,
) {
  const pending = BackgroundGeolocation.addWatcher(
    {
      requestPermissions: true,
      stale: false,
      distanceFilter: 50,
    },
    (position, error) => {
      if (error || !position) {
        onError();
        return;
      }
      onPosition({ lat: position.latitude, lng: position.longitude, accuracy: position.accuracy });
    },
  );
  watcher = pending;
  await pending;
}

export async function stopNativeLocationWatch() {
  const pending = watcher;
  watcher = null;
  if (!pending) return;
  const id = await pending.catch(() => null);
  if (id) await BackgroundGeolocation.removeWatcher({ id });
}
