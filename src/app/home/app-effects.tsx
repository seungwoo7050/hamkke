"use client";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { onAnyForegroundMessage, requestAnyPushToken } from "@/lib/push-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spaceChannelName } from "@/lib/supabase/channels";
import { useTRPC } from "@/trpc/client";
import { TOUCH_RECEIVED_EVENT } from "./touch-received";

// 화면을 그리지 않고, 탭과 무관하게 앱이 열려 있는 동안 계속 살아 있어야 하는
// 부수효과만 모은다(layout.tsx). 전에는 채팅 화면(chat-view)과 시차 위젯이
// 각각 들고 있어서, 3탭으로 나누면 대화 탭에 들어가야만 푸시가 등록되는
// 문제가 생긴다.
export function AppEffects({ spaceId, currentUserId }: { spaceId: string; currentUserId: string }) {
  const trpc = useTRPC();
  const registerPushTokenMutation = useMutation(trpc.push.registerToken.mutationOptions());
  const setTimezoneMutation = useMutation(trpc.profile.setTimezone.mutationOptions());

  useEffect(() => {
    // 브라우저가 아는 실제 타임존으로 동기화 — 여행 등으로 위치가 바뀌어도
    // 다음 방문 때 자동으로 맞는다.
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setTimezoneMutation.mutate({ timezone: detected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let unsubscribeForeground: (() => void) | undefined;

    requestAnyPushToken()
      .then((token) => {
        if (token) registerPushTokenMutation.mutate({ token });
      })
      .catch(() => {});

    // 앱이 열려 있을 땐 시스템 알림 대신 토스트로 보여준다(포그라운드에서는
    // FCM이 시스템 알림을 자동으로 띄우지 않는다).
    onAnyForegroundMessage((body) => toast(body))
      .then((unsub) => {
        unsubscribeForeground = unsub;
      })
      .catch(() => {});

    return () => unsubscribeForeground?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(spaceChannelName(spaceId))
      .on("broadcast", { event: "touch" }, (msg) => {
        const { senderId } = msg.payload as { senderId: string };
        if (senderId === currentUserId) return;
        window.dispatchEvent(new CustomEvent(TOUCH_RECEIVED_EVENT));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId]);

  return null;
}
