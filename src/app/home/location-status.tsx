"use client";

import { useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spaceChannelName } from "@/lib/supabase/channels";
import type { AppRouter } from "@/server/trpc/routers/_app";

type PartnerStatus = inferRouterOutputs<AppRouter>["location"]["partnerStatus"];
type PartnerLocation = NonNullable<PartnerStatus>["location"];

type LocationBroadcastPayload = { userId: string; capturedAt: string } & Omit<
  NonNullable<PartnerLocation>,
  "capturedAt"
>;

// 지도 없이 "상대가 위치를 공유 중인지 + 마지막으로 언제 갱신됐는지"만
// 실시간으로 보여준다. 지도/거리 표시는 다음 커밋(feat(location): 거리 계산
// 및 지도 UI)에서 이 컴포넌트를 확장한다.
export function LocationStatus({
  spaceId,
  currentUserId,
  initialStatus,
}: {
  spaceId: string;
  currentUserId: string;
  initialStatus: PartnerStatus;
}) {
  const [sharing, setSharing] = useState(initialStatus?.sharing ?? false);
  const [location, setLocation] = useState<PartnerLocation>(initialStatus?.location ?? null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(spaceChannelName(spaceId));

    channel
      .on("broadcast", { event: "location" }, (msg) => {
        const payload = msg.payload as LocationBroadcastPayload;
        if (payload.userId === currentUserId) return;
        setLocation({ ...payload, capturedAt: new Date(payload.capturedAt) });
        setSharing(true);
      })
      .on("broadcast", { event: "location-sharing" }, (msg) => {
        const { userId, enabled } = msg.payload as { userId: string; enabled: boolean };
        if (userId === currentUserId) return;
        setSharing(enabled);
        if (!enabled) setLocation(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId]);

  if (!sharing || !location) {
    return (
      <p className="text-muted-foreground border-border border-b px-6 py-2 text-xs">
        상대방이 위치공유를 꺼두었어요
      </p>
    );
  }

  return (
    <p className="text-muted-foreground border-border border-b px-6 py-2 text-xs">
      상대방 위치 갱신: {new Date(location.capturedAt).toLocaleTimeString("ko-KR")}
    </p>
  );
}
