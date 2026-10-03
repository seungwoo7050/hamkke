"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { isPlayApp, prepareAppCheckout } from "@/lib/alternative-billing";
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
