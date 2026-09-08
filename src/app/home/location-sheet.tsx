"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { EmptyState } from "@/components/brand/empty-state";
import { formatDistanceKm } from "@/lib/geo";
import { josa } from "@/lib/josa";
import { relativeTime } from "@/lib/relative-time";
import { useHydrated } from "@/lib/use-hydrated";
import { useNow } from "@/lib/use-now";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useDistance, useLocationSharing } from "./location-context";
import { displayName, useSpace } from "./space-context";

// Leaflet은 window에 의존해 서버에서 렌더링할 수 없다.
const LocationMap = dynamic(() => import("./location-map").then((m) => m.LocationMap), {
  ssr: false,
});

// Find My/지도 앱처럼 작게·중간·전체 세 단계로 걸리는 시트(DESIGN.md §4).
// 지도는 홈 바탕에 상시 깔지 않고 거리를 눌렀을 때만 연다 — 위치공유가
// 꺼지면 빈 화면이 되고, 상시 렌더링은 배터리·데이터 부담이라서.
const SNAP_POINTS = [0.4, 0.65, 1] as const;

export function LocationSheet({ children }: { children: React.ReactNode }) {
  const { summary } = useSpace();
  const { me, sharing, partnerSharing, partnerLocation } = useLocationSharing();
  const { km, approaching, meetingSoon } = useDistance();
  const hydrated = useHydrated();
  const now = useNow();
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[1]);
  const partnerName = displayName(summary.partner, "상대");

  const partnerPoint =
    partnerSharing && partnerLocation
      ? { lat: partnerLocation.lat, lng: partnerLocation.lng }
      : null;

  const status = !partnerSharing
    ? `${josa(partnerName, "이/가")} 위치공유를 꺼두었어요`
    : !sharing
      ? "내 위치공유를 켜면 거리를 볼 수 있어요"
      : [
          km !== null && formatDistanceKm(km),
          partnerLocation &&
            hydrated &&
            `마지막 위치 ${relativeTime(new Date(partnerLocation.capturedAt), now)}`,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Drawer snapPoints={[...SNAP_POINTS]} activeSnapPoint={snap} setActiveSnapPoint={setSnap}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="h-full max-h-[92dvh]">
        <DrawerHeader className="pb-4">
          <DrawerTitle>
            {meetingSoon
              ? approaching
                ? "곧 만나요! 점점 가까워지고 있어요"
                : "곧 만나요! 가까이 있어요"
              : `${partnerName}의 위치`}
          </DrawerTitle>
          <DrawerDescription>{status}</DrawerDescription>
        </DrawerHeader>
        {me || partnerPoint ? (
          <div className="overflow-hidden rounded-lg">
            <LocationMap me={me} partner={partnerPoint} />
          </div>
        ) : (
          <EmptyState caption="위치를 나누면 여기서 서로를 찾을 수 있어요" className="py-8" />
        )}
      </DrawerContent>
    </Drawer>
  );
}
