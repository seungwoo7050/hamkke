"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { computeStreak } from "@/lib/streak";
import { useTRPC } from "@/trpc/client";

// 별도 "체크인" 버튼 없이 메시지를 보낸 날을 자동으로 활동일로 센다
// (PRD.md §3.4 "연속 접속/대화 일수"). 연속 계산은 로컬 타임존 기준으로
// 클라이언트에서 한다(src/lib/streak.ts).
export function StreakBadge() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.streak.activeDates.queryOptions());

  const { streak, activeToday } = useMemo(() => {
    if (!data) return { streak: 0, activeToday: false };
    return computeStreak(data.map((d) => new Date(d)));
  }, [data]);

  if (streak === 0) return null;

  return (
    <span
      className="text-muted-foreground flex items-center gap-1 text-xs"
      title={activeToday ? "오늘도 대화했어요" : "오늘 대화하면 스트릭이 이어져요"}
    >
      <Flame className={activeToday ? "text-primary size-3.5" : "size-3.5"} />
      {streak}일 연속
    </span>
  );
}
