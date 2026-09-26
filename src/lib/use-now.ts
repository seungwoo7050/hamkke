"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

// 서버가 페이지를 그린 시각(epoch ms). 서버 렌더와 하이드레이션이 같은 "지금"으로
// 첫 렌더를 해야 시각 문구가 일치한다 — 각자 new Date()를 부르면 그 사이에 분이
// 넘어갈 때 글자가 달라진다(src/app/home/layout.tsx가 넣어 준다).
const NowSeedContext = createContext<number | null>(null);

export function NowSeedProvider({ value, children }: { value: number; children: React.ReactNode }) {
  return createElement(NowSeedContext.Provider, { value }, children);
}

/**
 * 렌더 중에 Date.now()를 직접 부르지 않고(react-hooks/purity) 현재 시각을
 * 상태로 들고 있다가 주기적으로 갱신한다. 시각·시차·"열렸는지" 판정처럼
 * 시간이 흐르면 바뀌어야 하는 화면이 새로고침 없이 따라가게 한다.
 *
 * 첫 렌더는 서버가 그린 시각(NowSeedProvider)으로 해서 하이드레이션이 서버 HTML과
 * 정확히 맞고, 마운트 직후 화면에 그리기 전에(layout effect) 지금 시각으로 바꾼다.
 * 그 사이에 분이 넘어갔다면 이 갱신이 DOM을 고친다 — 하이드레이션 불일치를
 * suppressHydrationWarning으로 덮으면 React가 서버 글자를 그대로 두고, 이후 같은
 * 값의 갱신은 DOM을 건드리지 않아 시계가 다음 분까지 멈춰 있었다. 탭을 옮겨 새로
 * 마운트될 때(레이아웃의 시각은 그대로)도 같은 갱신이 오래된 시각을 바로잡는다.
 */
export function useNow(intervalMs = 60_000) {
  const seed = useContext(NowSeedContext);
  const [now, setNow] = useState(() => (seed === null ? new Date() : new Date(seed)));
  useLayoutEffect(() => {
    // 서버 시각으로 맞춘 첫 렌더를 지금 시각으로 한 번 더 그리는 것이 이 effect의 목적이다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
