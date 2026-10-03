"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { distanceKm, isMeetingSoon } from "@/lib/geo";
import {
  isNativeLocation,
  startNativeLocationWatch,
  stopNativeLocationWatch,
} from "@/lib/location-native";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { useTRPC } from "@/trpc/client";
import { LocationConsentSheet } from "./location-consent-sheet";
import { useSpaceBroadcast } from "./realtime-context";
import { useSpace } from "./space-context";

type PartnerStatus = inferRouterOutputs<AppRouter>["location"]["partnerStatus"];
type PartnerLocation = NonNullable<PartnerStatus>["location"];
type Point = { lat: number; lng: number };

type LocationBroadcastPayload = { userId: string; capturedAt: string } & Omit<
  NonNullable<PartnerLocation>,
  "capturedAt"
>;

// ARCHITECTURE.md §5: 포그라운드에서 수 초~수십 초 간격. 완전한 움직임 기반
// adaptive 전송은 과해서, 고정 간격 스로틀로 단순화했다. 네이티브(Android)
// 에서도 포그라운드 전용으로 동작한다 - src/lib/location-native.ts 각주 참고
// (ACCESS_BACKGROUND_LOCATION 없이는 앱이 백그라운드로 간 뒤 위치 서비스
// 승격이 조용히 실패한다는 걸 실기기에서 확인, 배경위치는 범위 밖으로 뺌).
const SEND_THROTTLE_MS = 15000;

type LocationContextValue = {
  /** 내 위치공유 켜짐 여부 */
  sharing: boolean;
  toggleSharing: () => Promise<void>;
  togglePending: boolean;
  /** 이번 세션에서 받은 내 최신 좌표(전송 스로틀과 무관하게 즉시 갱신) */
  me: Point | null;
  partnerSharing: boolean;
  partnerLocation: PartnerLocation;
};

const LocationContext = createContext<LocationContextValue | null>(null);

// 위치공유 토글은 설정 시트(DESIGN.md §4)에 있지만, 좌표 감시(watchPosition)는
// 시트가 닫혀도 계속 돌아야 한다 - 그래서 토글 UI에서 떼어 layout.tsx
// 수준의 컨텍스트로 올렸다. 상대 위치 Broadcast 구독도 여기서 한 번만 한다.
export function LocationProvider({
  currentUserId,
  initialSharing,
  initialPartnerStatus,
  children,
}: {
  currentUserId: string;
  initialSharing: boolean;
  initialPartnerStatus: PartnerStatus;
  children: React.ReactNode;
}) {
  const trpc = useTRPC();
  const t = useTranslations("location");
  const [sharing, setSharing] = useState(initialSharing);
  const [me, setMe] = useState<Point | null>(null);
  const [partnerSharing, setPartnerSharing] = useState(initialPartnerStatus?.sharing ?? false);
  const [partnerLocation, setPartnerLocation] = useState<PartnerLocation>(
    initialPartnerStatus?.location ?? null,
  );
  const lastSentAt = useRef(0);
  const [consentOpen, setConsentOpen] = useState(false);

  const setSharingMutation = useMutation(trpc.location.setSharing.mutationOptions());
  const sendMutation = useMutation(trpc.location.send.mutationOptions());

  useEffect(() => {
    if (!sharing) return;

    function handlePosition(position: Point & { accuracy?: number }) {
      setMe({ lat: position.lat, lng: position.lng });
      const now = Date.now();
      if (now - lastSentAt.current < SEND_THROTTLE_MS) return;
      lastSentAt.current = now;
      sendMutation.mutate({ lat: position.lat, lng: position.lng, accuracy: position.accuracy });
    }

    function handleError() {
      toast.error(t("geoFailed"));
      setSharing(false);
      setSharingMutation.mutate({ enabled: false });
    }

    if (isNativeLocation()) {
      startNativeLocationWatch(handlePosition, handleError).catch(handleError);
      return () => {
        void stopNativeLocationWatch();
      };
    }

    // watchPosition 최초 호출 시 브라우저가 네이티브 위치 권한 다이얼로그를
    // 띄운다 - 별도 권한 요청 API가 없다.
    const watchId = navigator.geolocation.watchPosition(
      (position) =>
        handlePosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      handleError,
      { enableHighAccuracy: false, maximumAge: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing]);

  useSpaceBroadcast<LocationBroadcastPayload>("location", (payload) => {
    if (payload.userId === currentUserId) return;
    setPartnerLocation({ ...payload, capturedAt: new Date(payload.capturedAt) });
    setPartnerSharing(true);
  });

  useSpaceBroadcast<{ userId: string; enabled: boolean }>(
    "location-sharing",
    ({ userId, enabled }) => {
      if (userId === currentUserId) return;
      setPartnerSharing(enabled);
      if (!enabled) setPartnerLocation(null);
    },
  );

  // 켜기는 동의 시트를 거친다. 끄면 동의도 철회되므로(location.setSharing) 켤 때마다 묻는다.
  async function toggleSharing() {
    const next = !sharing;
    if (next && !isNativeLocation() && !("geolocation" in navigator)) {
      toast.error(t("unsupported"));
      return;
    }
    if (next) {
      setConsentOpen(true);
      return;
    }
    try {
      await setSharingMutation.mutateAsync({ enabled: false });
      setSharing(false);
      setMe(null);
    } catch {
      toast.error(t("toggleFailed"));
    }
  }

  async function agreeAndShare() {
    try {
      await setSharingMutation.mutateAsync({ enabled: true, consent: true });
      setConsentOpen(false);
      setSharing(true);
    } catch {
      toast.error(t("toggleFailed"));
    }
  }

  return (
    <LocationContext.Provider
      value={{
        sharing,
        toggleSharing,
        togglePending: setSharingMutation.isPending,
        me,
        partnerSharing,
        partnerLocation,
      }}
    >
      {children}
      <LocationConsentSheet
        open={consentOpen}
        pending={setSharingMutation.isPending}
        onOpenChange={setConsentOpen}
        onAgree={() => void agreeAndShare()}
      />
    </LocationContext.Provider>
  );
}

export function useLocationSharing() {
  const value = useContext(LocationContext);
  if (!value) throw new Error("useLocationSharing은 LocationProvider 안에서만 쓸 수 있어요");
  return value;
}

/**
 * 두 사람 사이 거리. 이번 세션에서 내 좌표를 받았다면 그걸로 실시간 계산하고,
 * 아니면(앱을 막 열었거나 내 공유가 꺼진 직후) 서버가 마지막 위치로 계산한
 * home.summary 값을 쓴다. 상대가 공유를 끄면 거리도 숨긴다(옵트인 원칙).
 *
 * "이동 패턴 감지"는 속도/경로 예측 없이, 직전 측정 대비 거리가 좁혀지는
 * 추세만 본다(src/lib/geo.ts 각주 참고).
 */
export function useDistance() {
  const { summary } = useSpace();
  const { me, sharing, partnerSharing, partnerLocation } = useLocationSharing();

  const live =
    me && partnerSharing && partnerLocation
      ? distanceKm(me, { lat: partnerLocation.lat, lng: partnerLocation.lng })
      : null;
  const km = live ?? (sharing && partnerSharing ? summary.distanceKm : null);

  const prevRef = useRef<number | null>(null);
  const [approaching, setApproaching] = useState(false);
  useEffect(() => {
    const prev = prevRef.current;
    if (km !== null && prev !== null && km !== prev) setApproaching(km < prev);
    prevRef.current = km;
  }, [km]);

  return { km, approaching, meetingSoon: km !== null && isMeetingSoon(km) };
}
