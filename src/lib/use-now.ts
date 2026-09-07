"use client";

import { useEffect, useState } from "react";

/**
 * 렌더 중에 Date.now()를 직접 부르지 않고(react-hooks/purity) 현재 시각을
 * 상태로 들고 있다가 주기적으로 갱신한다. 시각·시차·"열렸는지" 판정처럼
 * 시간이 흐르면 바뀌어야 하는 화면이 새로고침 없이 따라가게 한다.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
