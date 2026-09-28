"use client";

import { createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import type { inferRouterOutputs } from "@trpc/server";
import { useHydrated } from "@/lib/use-hydrated";
import type { AppRouter } from "@/server/trpc/routers/_app";

export type HomeSummary = inferRouterOutputs<AppRouter>["home"]["summary"];

type SpaceContextValue = {
  spaceId: string;
  currentUserId: string;
  summary: HomeSummary;
};

const SpaceContext = createContext<SpaceContextValue | null>(null);

// 탭 어디서든 "나/상대가 누구인지"와 장면 첫 렌더 값(home.summary)을 다시
// 조회하지 않고 쓰게 layout.tsx에서 한 번만 내려준다. 레이아웃은 탭 전환 때
// 다시 렌더되지 않으므로 이 값은 앱을 연 시점의 스냅샷이고, 실시간으로
// 바뀌는 값(위치·터치·메시지)은 각 화면이 Broadcast로 따로 갱신한다.
export function SpaceProvider({
  value,
  children,
}: {
  value: SpaceContextValue;
  children: React.ReactNode;
}) {
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const value = useContext(SpaceContext);
  if (!value) throw new Error("useSpace는 SpaceProvider 안에서만 쓸 수 있어요");
  return value;
}

/** 이름이 없으면(이메일 가입 직후 등) 호칭을 대신 쓴다. */
export function displayName(person: { name: string | null } | null, fallback: string) {
  return person?.name?.trim() || fallback;
}

/** 상대 이름 - 없으면 현재 언어의 호칭("상대" / "Your person"). */
export function usePartnerName() {
  const { summary } = useSpace();
  const t = useTranslations("common");
  return displayName(summary.partner, t("partner"));
}

/**
 * 내 시각 문구에 쓸 시간대. 서버 렌더와 첫 클라이언트 렌더는 프로필에 저장된
 * 값(브라우저가 동기화해 둔 것)을 써서 둘이 같은 글자를 내고, 하이드레이션 뒤엔
 * 지금 이 브라우저의 실제 시간대로 바꾼다(여행 중이면 여기서 한 번 다시 그려짐).
 */
export function useMyTimeZone() {
  const { summary } = useSpace();
  const hydrated = useHydrated();
  if (hydrated) return Intl.DateTimeFormat().resolvedOptions().timeZone;
  return summary.me.timezone ?? DEFAULT_TIME_ZONE;
}

// 프로필 시간대가 아직 없을 때(가입 직후 첫 화면)의 기본값 - 한국어 앱의 주 사용자 기준.
export const DEFAULT_TIME_ZONE = "Asia/Seoul";
