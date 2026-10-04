"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getGrantedPushToken, requestPushPermission } from "@/lib/firebase-client";
import { pushAvailability, readPushEnv } from "@/lib/push-availability";
import { isNativePush } from "@/lib/push-native";
import { useHydrated } from "@/lib/use-hydrated";
import { useTRPC } from "@/trpc/client";

// 설정 시트의 알림 줄. 웹에서 알림 권한은 여기서 "켜기"를 눌렀을 때만 묻는다
// (app-effects는 이미 허용한 기기의 토큰만 다시 등록한다). 아이폰 Safari에는 웹
// 푸시가 없어 홈 화면에 추가하는 법을 알려 준다. Android 앱은 네이티브 권한
// 대화상자가 맡아 이 줄을 그리지 않는다.
export function NotificationSection() {
  const t = useTranslations("notifications");
  const trpc = useTRPC();
  const registerToken = useMutation(trpc.push.registerToken.mutationOptions());
  // 브라우저 API는 서버 렌더에 없어서 하이드레이션 뒤에 읽는다. 권한 요청 결과는
  // 브라우저에 다시 묻지 않고 바로 반영한다.
  const hydrated = useHydrated();
  const [asked, setAsked] = useState<NotificationPermission | null>(null);
  const [pending, setPending] = useState(false);
  const state = hydrated ? (asked ?? pushAvailability(readPushEnv(isNativePush()))) : null;

  async function enable() {
    setPending(true);
    try {
      // 다른 await보다 먼저 - 사파리는 사용자 동작이 끝난 뒤의 요청을 거절한다.
      const permission = await requestPushPermission();
      setAsked(permission);
      if (permission !== "granted") return;
      const token = await getGrantedPushToken();
      if (!token) throw new Error("no token");
      await registerToken.mutateAsync({ token });
    } catch {
      toast.error(t("failed"));
    } finally {
      setPending(false);
    }
  }

  if (state === null || state === "native") return null;

  return (
    <div className="flex items-center gap-3 py-3">
      <Bell className="text-dusk-ink size-5" />
      <div className="flex-1">
        <p className="text-foreground text-base font-medium">{t("title")}</p>
        <p className="text-muted-foreground text-sm">{t(state)}</p>
        {state === "homeScreen" ? (
          <p className="text-muted-foreground text-xs">{t("homeScreenHow")}</p>
        ) : null}
      </div>
      {state === "default" ? (
        <Button type="button" variant="outline" disabled={pending} onClick={() => void enable()}>
          {t("enable")}
        </Button>
      ) : null}
    </div>
  );
}
