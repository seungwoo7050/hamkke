"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * 서버(UTC)와 브라우저(사용자 로컬 타임존)가 같은 시각을 다르게 포맷해
 * 하이드레이션이 깨지는 걸 막는다 - 로컬 시각 문구는 true가 된 뒤에만 그린다.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
