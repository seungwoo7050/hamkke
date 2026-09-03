"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

// 구독 시작만 다룬다(ARCHITECTURE.md §6 — Checkout으로 시작, 해지/결제수단
// 변경은 Customer Portal로 위임). Portal 연동은 다음 커밋에서 붙인다.
export function BillingSection() {
  const trpc = useTRPC();
  const { data: subscription } = useQuery(trpc.billing.status.queryOptions());
  const checkoutMutation = useMutation(
    trpc.billing.createCheckoutSession.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.assign(url);
      },
      onError: () => toast.error("결제 페이지로 이동하지 못했어요"),
    }),
  );

  if (subscription?.status === "active") {
    return (
      <div className="border-border flex items-center gap-1 border-b px-6 py-3 text-xs">
        <Crown className="text-primary size-3.5" />
        <span className="text-foreground">Hamkke Premium 구독 중</span>
      </div>
    );
  }

  return (
    <div className="border-border border-b px-6 py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => checkoutMutation.mutate()}
        disabled={checkoutMutation.isPending}
      >
        <Crown /> 프리미엄 구독하기
      </Button>
    </div>
  );
}
