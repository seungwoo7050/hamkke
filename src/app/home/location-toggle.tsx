"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, MapPinOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

// ARCHITECTURE.md §5: 포그라운드에서 수 초~수십 초 간격. 완전한 움직임 기반
// adaptive 전송은 과해서, 고정 간격 스로틀로 단순화했다.
const SEND_THROTTLE_MS = 15000;

export function LocationShareToggle({ initialSharing }: { initialSharing: boolean }) {
  const trpc = useTRPC();
  const [sharing, setSharing] = useState(initialSharing);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAt = useRef(0);

  const setSharingMutation = useMutation(trpc.location.setSharing.mutationOptions());
  const sendMutation = useMutation(trpc.location.send.mutationOptions());

  useEffect(() => {
    if (!sharing) return;

    // watchPosition 최초 호출 시 브라우저가 네이티브 위치 권한 다이얼로그를
    // 띄운다 — 별도 권한 요청 API가 없다.
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAt.current < SEND_THROTTLE_MS) return;
        lastSentAt.current = now;
        sendMutation.mutate({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        toast.error("위치를 가져오지 못했어요. 브라우저 위치 권한을 확인해주세요");
        setSharing(false);
        setSharingMutation.mutate({ enabled: false });
      },
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
    if (next && !("geolocation" in navigator)) {
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
