"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

// 구독 시작은 Checkout, 해지/결제수단 변경은 Customer Portal로 위임한다
// (ARCHITECTURE.md §6 — 자체 UI로 결제 로직을 구현하지 않는다).
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
  const portalMutation = useMutation(
    trpc.billing.createPortalSession.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.assign(url);
      },
      onError: () => toast.error("구독 관리 페이지로 이동하지 못했어요"),
    }),
  );

  if (subscription?.status === "active") {
    return (
      <div className="border-border flex items-center justify-between border-b px-6 py-3 text-xs">
        <span className="flex items-center gap-1">
          <Crown className="text-primary size-3.5" />
          <span className="text-foreground">Hamkke Premium 구독 중</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => portalMutation.mutate()}
          disabled={portalMutation.isPending}
        >
          구독 관리
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border border-b px-6 py-3">
      <Button
        type="button"
        size="sm"
        onClick={() => checkoutMutation.mutate()}
        disabled={checkoutMutation.isPending}
      >
        <Crown /> 프리미엄 구독하기
      </Button>
    </div>
  );
}
