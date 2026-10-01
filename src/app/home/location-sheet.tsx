"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/i18n/use-format";
import { bestTimes, flightProgress, pickFlight } from "@/lib/flight";
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
import { usePartnerName, useSpace } from "./space-context";

// Leaflet은 window에 의존해 서버에서 렌더링할 수 없다.
const LocationMap = dynamic(() => import("./location-map").then((m) => m.LocationMap), {
  ssr: false,
});
const FlightMap = dynamic(() => import("./flight-map").then((m) => m.FlightMap), {
  ssr: false,
});

// Find My/지도 앱처럼 작게·중간·전체 세 단계로 걸리는 시트(DESIGN.md §4).
// 지도는 홈 바탕에 상시 깔지 않고 거리를 눌렀을 때만 연다 - 위치공유가
// 꺼지면 빈 화면이 되고, 상시 렌더링은 배터리·데이터 부담이라서.
const SNAP_POINTS = [0.4, 0.65, 1] as const;

export function LocationSheet({ children }: { children: React.ReactNode }) {
  const { currentUserId } = useSpace();
  const { me, sharing, partnerSharing, partnerLocation, toggleSharing, togglePending } =
    useLocationSharing();
  const { km, approaching, meetingSoon } = useDistance();
  const now = useNow();
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[1]);
  const t = useTranslations("location");
  const fmt = useFormat();
  const partnerName = usePartnerName();
  const names = fmt.particles(partnerName);
  const flights = useFlights();
  const picked = flights.data ? pickFlight(flights.data, now) : null;
  // 비행 중이면 두 사람 위치 대신 비행 경로를 보여준다(PRD §3.3.1).
  const flying = picked?.phase === "inFlight" ? picked.flight : null;

  function flightRemaining(f: NonNullable<typeof flying>) {
    const { arrivalAt, estimated } = bestTimes(f);
    const time = fmt.remaining(arrivalAt.getTime() - now.getTime());
    if (!time) return t("landingSoon");
    return t(estimated ? "flightRemainingScheduled" : "flightRemaining", { time });
  }

  const partnerPoint =
    partnerSharing && partnerLocation
      ? { lat: partnerLocation.lat, lng: partnerLocation.lng }
      : null;

  const status = !partnerSharing
    ? t("partnerOff", names)
    : !sharing
      ? t("turnOnMine")
      : [
          km !== null && fmt.distance(km),
          partnerLocation &&
            t("lastSeen", { when: fmt.relative(new Date(partnerLocation.capturedAt), now) }),
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
                ? t("meInTheAir")
                : t("partnerInTheAir", names)
              : meetingSoon
                ? approaching
                  ? t("meetingApproaching")
                  : t("meetingNear")
                : t("partnerLocation", { name: partnerName })}
          </DrawerTitle>
          <DrawerDescription>
            {flying
              ? t("flightStatus", {
                  flight: flying.flightNumber,
                  from: flying.from.city,
                  to: flying.to.city,
                  remaining: flightRemaining(flying),
                })
              : status}
          </DrawerDescription>
        </DrawerHeader>
        {flying ? (
          <>
            <div className="overflow-hidden rounded-lg">
              <FlightMap from={flying.from} to={flying.to} progress={flightProgress(flying, now)} />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">{t("estimateNote")}</p>
          </>
        ) : me || partnerPoint ? (
          <div className="overflow-hidden rounded-lg">
            <LocationMap me={me} partner={partnerPoint} />
          </div>
        ) : (
          <EmptyState art="location" caption={t("empty")} className="py-8" />
        )}
        {!sharing && !flying && (
          // 첫날엔 여기가 막다른 곳이었다 - 설명만 하고 켜는 곳(설정 시트)은 따로
          // 있었음. 옵트인 원칙(ARCHITECTURE.md §5)대로 누르기 전엔 켜지 않는다.
          <div className="mt-4 flex flex-col gap-2">
            <Button size="lg" disabled={togglePending} onClick={() => void toggleSharing()}>
              <MapPin className="size-5" /> {t("share")}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              {t("shareNote", { name: partnerName })}
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
