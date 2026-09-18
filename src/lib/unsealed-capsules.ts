"use client";

import { useSyncExternalStore } from "react";

// 받은 캡슐을 "내가 직접 열어봤는지" — 이 기기에서의 편의 상태라 서버에 두지
// 않는다(상대에게 알리는 기능이 아님). 저장소를 못 쓰는 환경(시크릿 창·차단)
// 에선 매번 봉인된 채로 보이고 한 번 누르면 열린다 — 내용을 잃지는 않는다.
const KEY = "hamkke:unsealed-capsules";
const EMPTY: ReadonlySet<string> = new Set();

let cache: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

export function markCapsuleUnsealed(id: string) {
  const next = new Set(read());
  next.add(id);
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // 저장 실패해도 이번 화면에선 열린 상태가 유지된다.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 서버 렌더·첫 렌더에선 비어 있다(캡슐 목록도 클라이언트에서 불러오므로 깜빡임 없음). */
export function useUnsealedCapsules() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
