"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { bestTimes, flightProgress, formatRemaining, pickFlight } from "@/lib/flight";
import { formatDistanceKm } from "@/lib/geo";
import { josa } from "@/lib/josa";
import { relativeTime } from "@/lib/relative-time";
import { useNow } from "@/lib/use-now";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useFlights } from "./flights";
import { useDistance, useLocationSharing } from "./location-context";
import { displayName, useSpace } from "./space-context";

// Leaflet은 window에 의존해 서버에서 렌더링할 수 없다.
const LocationMap = dynamic(() => import("./location-map").then((m) => m.LocationMap), {
  ssr: false,
});
const FlightMap = dynamic(() => import("./flight-map").then((m) => m.FlightMap), {
  ssr: false,
});

// Find My/지도 앱처럼 작게·중간·전체 세 단계로 걸리는 시트(DESIGN.md §4).
// 지도는 홈 바탕에 상시 깔지 않고 거리를 눌렀을 때만 연다 — 위치공유가
// 꺼지면 빈 화면이 되고, 상시 렌더링은 배터리·데이터 부담이라서.
const SNAP_POINTS = [0.4, 0.65, 1] as const;

export function LocationSheet({ children }: { children: React.ReactNode }) {
  const { currentUserId, summary } = useSpace();
  const { me, sharing, partnerSharing, partnerLocation, toggleSharing, togglePending } =
    useLocationSharing();
  const { km, approaching, meetingSoon } = useDistance();
  const now = useNow();
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[1]);
  const partnerName = displayName(summary.partner, "상대");
  const flights = useFlights();
  const picked = flights.data ? pickFlight(flights.data, now) : null;
  // 비행 중이면 두 사람 위치 대신 비행 경로를 보여준다(PRD §3.3.1).
  const flying = picked?.phase === "inFlight" ? picked.flight : null;

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
            {flying
              ? flying.travelerId === currentUserId
                ? "하늘 위에 있어요"
                : `${josa(partnerName, "은/는")} 하늘 위`
              : meetingSoon
                ? approaching
                  ? "곧 만나요! 점점 가까워지고 있어요"
                  : "곧 만나요! 가까이 있어요"
                : `${partnerName}의 위치`}
          </DrawerTitle>
          <DrawerDescription>
            {flying
              ? `${flying.flightNumber} ${flying.from.city} → ${flying.to.city} · ${formatRemaining(
                  bestTimes(flying).arrivalAt.getTime() - now.getTime(),
                )} 남음${bestTimes(flying).estimated ? "(예정 기준)" : ""}`
              : status}
          </DrawerDescription>
        </DrawerHeader>
        {flying ? (
          <>
            <div className="overflow-hidden rounded-lg">
              <FlightMap from={flying.from} to={flying.to} progress={flightProgress(flying, now)} />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              최단 비행 경로 위의 추정 위치예요. 실제 항로와는 조금 다를 수 있어요.
            </p>
          </>
        ) : me || partnerPoint ? (
          <div className="overflow-hidden rounded-lg">
            <LocationMap me={me} partner={partnerPoint} />
          </div>
        ) : (
          <EmptyState caption="위치를 나누면 여기서 서로를 찾을 수 있어요" className="py-8" />
        )}
        {!sharing && !flying && (
          // 첫날엔 여기가 막다른 곳이었다 — 설명만 하고 켜는 곳(설정 시트)은 따로
          // 있었음. 옵트인 원칙(ARCHITECTURE.md §5)대로 누르기 전엔 켜지 않는다.
          <div className="mt-4 flex flex-col gap-2">
            <Button size="lg" disabled={togglePending} onClick={() => void toggleSharing()}>
              <MapPin className="size-5" /> 내 위치 나누기
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              {partnerName}에게만 보이고, 설정에서 언제든 끌 수 있어요
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
