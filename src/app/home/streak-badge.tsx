"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Flame } from "lucide-react";
import { cn } from "cn";
import { computeStreak } from "@/lib/streak";
import { useTRPC } from "@/trpc/client";

// 별도 "체크인" 버튼 없이 메시지를 보낸 날을 자동으로 활동일로 센다
// (PRD.md §3.4 "연속 접속/대화 일수"). 연속 계산은 로컬 타임존 기준으로
// 클라이언트에서 한다(src/lib/streak.ts).
export function StreakBadge() {
  const t = useTranslations("streak");
  const trpc = useTRPC();
  const { data } = useQuery(trpc.streak.activeDates.queryOptions());

  const { streak, activeToday } = useMemo(() => {
    if (!data) return { streak: 0, activeToday: false };
    return computeStreak(data.map((d) => new Date(d)));
  }, [data]);

  if (streak === 0) return null;

  return (
    // glow = 터치·스트릭 하이라이트 전용 토큰(DESIGN.md §3.1). 오늘 아직 대화
    // 전이면 흐리게 — 이어갈 수 있다는 신호만 조용히.
    <span
      className={cn(
        "text-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        activeToday ? "bg-glow/40" : "bg-muted text-muted-foreground",
      )}
      title={activeToday ? t("activeToday") : t("keepGoing")}
    >
      <Flame className={cn("size-4", activeToday && "text-primary")} />
      {t("days", { count: streak })}
    </span>
  );
}
