"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { toast } from "sonner";
import {
  isNativeLocation,
  startNativeLocationWatch,
  stopNativeLocationWatch,
} from "@/lib/location-native";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spaceChannelName } from "@/lib/supabase/channels";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { useTRPC } from "@/trpc/client";

type PartnerStatus = inferRouterOutputs<AppRouter>["location"]["partnerStatus"];
type PartnerLocation = NonNullable<PartnerStatus>["location"];
type Point = { lat: number; lng: number };

type LocationBroadcastPayload = { userId: string; capturedAt: string } & Omit<
  NonNullable<PartnerLocation>,
  "capturedAt"
>;

// ARCHITECTURE.md §5: 포그라운드에서 수 초~수십 초 간격. 완전한 움직임 기반
// adaptive 전송은 과해서, 고정 간격 스로틀로 단순화했다. 네이티브(Android)
// 에서도 포그라운드 전용으로 동작한다 — src/lib/location-native.ts 각주 참고
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
// 시트가 닫혀도 계속 돌아야 한다 — 그래서 토글 UI에서 떼어 layout.tsx
// 수준의 컨텍스트로 올렸다. 상대 위치 Broadcast 구독도 여기서 한 번만 한다.
export function LocationProvider({
  spaceId,
  currentUserId,
  initialSharing,
  initialPartnerStatus,
  children,
}: {
  spaceId: string;
  currentUserId: string;
  initialSharing: boolean;
  initialPartnerStatus: PartnerStatus;
  children: React.ReactNode;
}) {
  const trpc = useTRPC();
  const [sharing, setSharing] = useState(initialSharing);
  const [me, setMe] = useState<Point | null>(null);
  const [partnerSharing, setPartnerSharing] = useState(initialPartnerStatus?.sharing ?? false);
  const [partnerLocation, setPartnerLocation] = useState<PartnerLocation>(
    initialPartnerStatus?.location ?? null,
  );
  const lastSentAt = useRef(0);

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
      toast.error("위치를 가져오지 못했어요. 위치 권한을 확인해주세요");
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
    // 띄운다 — 별도 권한 요청 API가 없다.
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

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(spaceChannelName(spaceId))
      .on("broadcast", { event: "location" }, (msg) => {
        const payload = msg.payload as LocationBroadcastPayload;
        if (payload.userId === currentUserId) return;
        setPartnerLocation({ ...payload, capturedAt: new Date(payload.capturedAt) });
        setPartnerSharing(true);
      })
      .on("broadcast", { event: "location-sharing" }, (msg) => {
        const { userId, enabled } = msg.payload as { userId: string; enabled: boolean };
        if (userId === currentUserId) return;
        setPartnerSharing(enabled);
        if (!enabled) setPartnerLocation(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId]);

  async function toggleSharing() {
    const next = !sharing;
    if (next && !isNativeLocation() && !("geolocation" in navigator)) {
      toast.error("이 브라우저는 위치공유를 지원하지 않아요");
      return;
    }
    try {
      await setSharingMutation.mutateAsync({ enabled: next });
      setSharing(next);
      if (!next) setMe(null);
    } catch {
      toast.error("위치공유 설정에 실패했어요");
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
    </LocationContext.Provider>
  );
}

export function useLocationSharing() {
  const value = useContext(LocationContext);
  if (!value) throw new Error("useLocationSharing은 LocationProvider 안에서만 쓸 수 있어요");
  return value;
}
