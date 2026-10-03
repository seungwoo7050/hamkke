"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { canCheckoutHere, isPlayApp, prepareAppCheckout } from "@/lib/alternative-billing";
import { useTRPC } from "@/trpc/client";

/**
 * 프리미엄 결제 시작(설정 시트·한도 안내가 함께 쓴다). 웹은 바로 Stripe Checkout으로,
 * Play 앱은 한국 대체 결제 순서(가능 여부 → Google 안내 → 거래 토큰)를 먼저 거친 뒤
 * 토큰을 실어 같은 Checkout으로 간다(ARCHITECTURE §6, src/lib/alternative-billing.ts).
 */
export function useStartCheckout() {
  const trpc = useTRPC();
  const t = useTranslations("billing");
  const [preparing, setPreparing] = useState(false);
  const checkout = useMutation(
    trpc.billing.createCheckoutSession.mutationOptions({
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (err) =>
        toast.error(err.data?.code === "TOO_MANY_REQUESTS" ? err.message : t("checkoutFailed")),
    }),
  );

  async function start() {
    if (!isPlayApp()) {
      checkout.mutate(undefined);
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareAppCheckout();
      if (prepared.kind === "token") {
        checkout.mutate({ externalTransactionToken: prepared.externalTransactionToken });
      } else if (prepared.kind === "unavailable") {
        toast(t("appUnavailable"));
      }
    } catch {
      toast.error(t("checkoutFailed"));
    } finally {
      setPreparing(false);
    }
  }

  return { start, pending: preparing || checkout.isPending };
}

/**
 * 여기서 프리미엄을 살 수 있는지. Play 앱에서 대체 결제를 쓸 수 없는 사용자(한국 외)는
 * 앱 안에 결제 버튼도 업그레이드 권유도 두지 않는다 - Play 결제 대신 다른 결제로
 * 유도하는 것도 정책 위반이라 "웹에서 사세요" 같은 안내도 하지 않는다. 확인 전에는
 * false로 두어 버튼이 잠깐 보였다 사라지지 않게 한다.
 */
export function useCanCheckoutHere() {
  const { data } = useQuery({
    queryKey: ["can-checkout-here"],
    queryFn: () => canCheckoutHere().catch(() => false),
    staleTime: Infinity,
  });
  return data === true;
}
