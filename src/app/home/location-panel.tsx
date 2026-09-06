"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { distanceKm, formatDistanceKm, isMeetingSoon } from "@/lib/geo";
import { useLocationSharing } from "./location-context";

// Leaflet은 window에 의존해 서버에서 렌더링할 수 없다.
const LocationMap = dynamic(() => import("./location-map").then((m) => m.LocationMap), {
  ssr: false,
});

// 좌표 감시·상대 위치 구독은 LocationProvider(layout.tsx)가 맡고, 여기서는
// 그 상태를 지도·거리로 보여주기만 한다.
export function LocationPanel() {
  const { me, partnerSharing: sharing, partnerLocation } = useLocationSharing();

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
      </div>
      {(me || partnerPoint) && <LocationMap me={me} partner={partnerPoint} />}
    </div>
  );
}
