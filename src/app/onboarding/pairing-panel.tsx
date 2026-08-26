"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { useTRPC } from "@/trpc/client";

type PairingStatus = inferRouterOutputs<AppRouter>["pairing"]["getStatus"];

export function PairingPanel({ initialStatus }: { initialStatus: PairingStatus }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "redeem">("choose");
  const [code, setCode] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);

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
      onSuccess: () => router.push("/home"),
      onError: (error) => setRedeemError(error.message),
    }),
  );

  const status = statusQuery.data;

  useEffect(() => {
    if (status.status === "active") {
      router.replace("/home");
    }
  }, [status.status, router]);

  if (status.status === "active") {
    return null;
  }

  if (status.status === "pending") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">이 코드를 상대에게 공유하세요.</p>
        <p className="text-foreground text-4xl font-semibold tracking-widest">
          {status.inviteCode}
        </p>
        <p className="text-muted-foreground text-sm">
          24시간 안에 입력해야 해요. 상대가 입력하면 자동으로 연결돼요.
        </p>
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
          placeholder="초대코드 6자리"
          maxLength={6}
          required
        />
        {redeemError && <p className="text-danger text-sm">{redeemError}</p>}
        <Button type="submit" disabled={redeemInviteCode.isPending}>
          {redeemInviteCode.isPending ? "확인 중..." : "연결하기"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
          뒤로
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => createInviteCode.mutate()} disabled={createInviteCode.isPending}>
        {createInviteCode.isPending ? "생성 중..." : "초대코드 만들기"}
      </Button>
      <Button variant="outline" onClick={() => setMode("redeem")}>
        받은 코드 입력하기
      </Button>
    </div>
  );
}
