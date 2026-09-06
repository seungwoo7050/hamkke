"use client";

import { isLikelySleeping, timezoneDiffHours } from "@/lib/timezone";

export function TimezoneWidget({
  initialMe,
  initialPartner,
}: {
  initialMe: string | null;
  initialPartner: string | null;
}) {
  if (!initialPartner) return null;

  const partnerTime = new Intl.DateTimeFormat("ko-KR", {
    timeZone: initialPartner,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const sleeping = isLikelySleeping(initialPartner);
  const diff = initialMe ? Math.round(timezoneDiffHours(initialMe, initialPartner)) : null;

  return (
    <p className="text-muted-foreground border-border border-b px-6 py-2 text-xs">
      상대방 현지 시각 {partnerTime}
      {diff !== null && diff !== 0 && ` (${diff > 0 ? "+" : ""}${diff}시간)`}
      {sleeping && " · 지금 자고 있을 시간이에요"}
    </p>
  );
}
