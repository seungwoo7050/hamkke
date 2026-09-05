"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, MapPinOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isNativeLocation,
  startNativeLocationWatch,
  stopNativeLocationWatch,
} from "@/lib/location-native";
import { useTRPC } from "@/trpc/client";

// ARCHITECTURE.md §5: 포그라운드에서 수 초~수십 초 간격. 완전한 움직임 기반
// adaptive 전송은 과해서, 고정 간격 스로틀로 단순화했다. 네이티브(Android)
// 에서도 포그라운드 전용으로 동작한다 — src/lib/location-native.ts 각주 참고
// (ACCESS_BACKGROUND_LOCATION 없이는 앱이 백그라운드로 간 뒤 위치 서비스
// 승격이 조용히 실패한다는 걸 실기기에서 확인, 배경위치는 범위 밖으로 뺌).
const SEND_THROTTLE_MS = 15000;

export function LocationShareToggle({
  initialSharing,
  onMyPosition,
}: {
  initialSharing: boolean;
  // 지도(LocationStatus)에 "내 위치" 마커를 그리기 위해 전송에 성공한 좌표를
  // 그대로 올려보낸다 — 별도로 위치를 다시 조회하지 않는다.
  onMyPosition?: (position: { lat: number; lng: number }) => void;
}) {
  const trpc = useTRPC();
  const [sharing, setSharing] = useState(initialSharing);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAt = useRef(0);

  const setSharingMutation = useMutation(trpc.location.setSharing.mutationOptions());
  const sendMutation = useMutation(trpc.location.send.mutationOptions());

  useEffect(() => {
    if (!sharing) return;

    function handlePosition(position: { lat: number; lng: number; accuracy?: number }) {
      onMyPosition?.({ lat: position.lat, lng: position.lng });
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
    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing]);

  async function handleToggle() {
    const next = !sharing;
    if (next && !isNativeLocation() && !("geolocation" in navigator)) {
      toast.error("이 브라우저는 위치공유를 지원하지 않아요");
      return;
    }
    try {
      await setSharingMutation.mutateAsync({ enabled: next });
      setSharing(next);
    } catch {
      toast.error("위치공유 설정에 실패했어요");
    }
  }

  return (
    <Button
      type="button"
      variant={sharing ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={setSharingMutation.isPending}
    >
      {sharing ? <MapPin /> : <MapPinOff />}
      위치공유 {sharing ? "켜짐" : "꺼짐"}
    </Button>
  );
}
