"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { inferRouterOutputs } from "@trpc/server";
import { distanceKm, formatDistanceKm, isMeetingSoon } from "@/lib/geo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spaceChannelName } from "@/lib/supabase/channels";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { LocationShareToggle } from "./location-toggle";

// Leaflet은 window에 의존해 서버에서 렌더링할 수 없다.
const LocationMap = dynamic(() => import("./location-map").then((m) => m.LocationMap), {
  ssr: false,
});

type PartnerStatus = inferRouterOutputs<AppRouter>["location"]["partnerStatus"];
type PartnerLocation = NonNullable<PartnerStatus>["location"];

type LocationBroadcastPayload = { userId: string; capturedAt: string } & Omit<
  NonNullable<PartnerLocation>,
  "capturedAt"
>;

// LocationShareToggle(내 위치 전송)과 지도(내 위치 + 상대 위치 표시)가 "내
// 좌표" 상태를 공유해야 해서, 둘을 감싸는 클라이언트 컴포넌트로 묶었다.
export function LocationPanel({
  spaceId,
  currentUserId,
  initialSharing,
  initialPartnerStatus,
}: {
  spaceId: string;
  currentUserId: string;
  initialSharing: boolean;
  initialPartnerStatus: PartnerStatus;
}) {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [sharing, setSharing] = useState(initialPartnerStatus?.sharing ?? false);
  const [partnerLocation, setPartnerLocation] = useState<PartnerLocation>(
    initialPartnerStatus?.location ?? null,
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(spaceChannelName(spaceId));

    channel
      .on("broadcast", { event: "location" }, (msg) => {
        const payload = msg.payload as LocationBroadcastPayload;
        if (payload.userId === currentUserId) return;
        setPartnerLocation({ ...payload, capturedAt: new Date(payload.capturedAt) });
        setSharing(true);
      })
      .on("broadcast", { event: "location-sharing" }, (msg) => {
        const { userId, enabled } = msg.payload as { userId: string; enabled: boolean };
        if (userId === currentUserId) return;
        setSharing(enabled);
        if (!enabled) setPartnerLocation(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId]);

  const partnerPoint =
    sharing && partnerLocation ? { lat: partnerLocation.lat, lng: partnerLocation.lng } : null;
  const distanceKmValue = me && partnerPoint ? distanceKm(me, partnerPoint) : null;
  const distance = distanceKmValue !== null ? formatDistanceKm(distanceKmValue) : null;

  // "이동 패턴 감지"는 속도/경로 예측 없이, 직전 측정 대비 거리가 좁혀지는
  // 추세만 본다(src/lib/geo.ts 각주 참고).
  const prevDistanceRef = useRef<number | null>(null);
  const [approaching, setApproaching] = useState(false);
  useEffect(() => {
    const prev = prevDistanceRef.current;
    if (distanceKmValue !== null && prev !== null) {
      setApproaching(distanceKmValue < prev);
    }
    prevDistanceRef.current = distanceKmValue;
  }, [distanceKmValue]);

  const meetingSoon = distanceKmValue !== null && isMeetingSoon(distanceKmValue);

  return (
    <div className="border-border border-b">
      {meetingSoon && (
        <div className="bg-primary/10 text-primary px-6 py-2 text-xs font-medium">
          {approaching ? "곧 만나요! 점점 가까워지고 있어요" : "곧 만나요! 가까이 있어요"}
        </div>
      )}
      <div className="flex items-center justify-between px-6 py-2">
        <div className="text-muted-foreground flex flex-col text-xs">
          <span>
            {sharing && partnerLocation
              ? `상대방 위치 갱신: ${new Date(partnerLocation.capturedAt).toLocaleTimeString("ko-KR")}`
              : "상대방이 위치공유를 꺼두었어요"}
          </span>
          {distance && <span>거리 {distance}</span>}
        </div>
        <LocationShareToggle initialSharing={initialSharing} onMyPosition={setMe} />
      </div>
      {(me || partnerPoint) && <LocationMap me={me} partner={partnerPoint} />}
    </div>
  );
}
