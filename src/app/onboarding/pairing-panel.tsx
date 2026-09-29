"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { inferRouterOutputs } from "@trpc/server";
import { LoadingMotif } from "@/components/brand/loading-motif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { useTRPC } from "@/trpc/client";
import { ConnectedMoment } from "./connected-moment";

type PairingStatus = inferRouterOutputs<AppRouter>["pairing"]["getStatus"];

// 연결된 순간(ConnectedMoment)을 보여 준 뒤 홈으로 가기까지 - 실이 다 이어지고
// 문구가 읽힐 만큼. 움직임 줄이기 설정이면 결과만 잠깐 보여 준다.
const CONNECTED_HOLD_MS = 2200;
const CONNECTED_HOLD_REDUCED_MS = 1200;

export function PairingPanel({ initialStatus }: { initialStatus: PairingStatus }) {
  const trpc = useTRPC();
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "redeem">("choose");
  const [code, setCode] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  const statusQuery = useQuery({
    ...trpc.pairing.getStatus.queryOptions(),
    initialData: initialStatus,
    // 상대가 코드를 입력하는 순간을 놓치지 않도록 대기 중일 때만 짧게 폴링한다.
    // 탭이 백그라운드에 있어도(상대를 기다리며 다른 앱을 볼 수 있으니) 계속 확인한다.
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3000 : false),
    refetchIntervalInBackground: true,
  });

  const createInviteCode = useMutation(
    trpc.pairing.createInviteCode.mutationOptions({
      onSuccess: () => statusQuery.refetch(),
    }),
  );

  const redeemInviteCode = useMutation(
    trpc.pairing.redeemInviteCode.mutationOptions({
      onSuccess: () => setRedeemed(true),
      onError: (error) => setRedeemError(error.message),
    }),
  );

  const status = statusQuery.data;

  // 코드를 넣은 쪽은 mutation 성공으로, 코드를 만든 쪽은 폴링으로 연결을 안다.
  const connected = redeemed || status.status === "active";

  useEffect(() => {
    if (!connected) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => router.replace("/home"),
      reduced ? CONNECTED_HOLD_REDUCED_MS : CONNECTED_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [connected, router]);

  if (connected) {
    return <ConnectedMoment />;
  }

  if (status.status === "pending") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground">{t("shareCode")}</p>
          <p className="text-foreground text-4xl font-semibold tracking-widest">
            {status.inviteCode}
          </p>
          <p className="text-muted-foreground text-sm">{t("codeExpiry")}</p>
        </div>
        <LoadingMotif label={t("waiting")} />
      </div>
    );
  }

  if (mode === "redeem") {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setRedeemError(null);
          redeemInviteCode.mutate({ code });
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("codePlaceholder")}
          maxLength={6}
          required
        />
        {redeemError && <p className="text-danger text-sm">{redeemError}</p>}
        <Button type="submit" disabled={redeemInviteCode.isPending}>
          {redeemInviteCode.isPending ? t("checking") : t("connect")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
          {tc("back")}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => createInviteCode.mutate()} disabled={createInviteCode.isPending}>
        {createInviteCode.isPending ? t("creating") : t("createCode")}
      </Button>
      <Button variant="outline" onClick={() => setMode("redeem")}>
        {t("enterCode")}
      </Button>
    </div>
  );
}
