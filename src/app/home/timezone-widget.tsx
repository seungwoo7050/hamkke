"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { isLikelySleeping, timezoneDiffHours } from "@/lib/timezone";
import { useTRPC } from "@/trpc/client";

export function TimezoneWidget({
  initialMe,
  initialPartner,
}: {
  initialMe: string | null;
  initialPartner: string | null;
}) {
  const trpc = useTRPC();
  const [me, setMe] = useState(initialMe);
  const setTimezoneMutation = useMutation(trpc.profile.setTimezone.mutationOptions());

  useEffect(() => {
    // 브라우저가 아는 실제 타임존으로 동기화 — 여행 등으로 위치가 바뀌어도
    // 다음 방문 때 자동으로 맞는다.
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && detected !== initialMe) {
      setTimezoneMutation.mutate({ timezone: detected }, { onSuccess: () => setMe(detected) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialPartner) return null;

  const partnerTime = new Intl.DateTimeFormat("ko-KR", {
    timeZone: initialPartner,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const sleeping = isLikelySleeping(initialPartner);
  const diff = me ? Math.round(timezoneDiffHours(me, initialPartner)) : null;

  return (
    <p className="text-muted-foreground border-border border-b px-6 py-2 text-xs">
      상대방 현지 시각 {partnerTime}
      {diff !== null && diff !== 0 && ` (${diff > 0 ? "+" : ""}${diff}시간)`}
      {sleeping && " · 지금 자고 있을 시간이에요"}
    </p>
  );
}
