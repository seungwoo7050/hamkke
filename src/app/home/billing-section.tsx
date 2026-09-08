"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

// 구독 시작은 Checkout, 해지/결제수단 변경은 Customer Portal로 위임한다
// (ARCHITECTURE.md §6 — 자체 UI로 결제 로직을 구현하지 않는다). 설정성
// 기능이라 홈이 아니라 설정 시트의 한 줄로 둔다(DESIGN.md §4).
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

  const premium = subscription?.status === "active";

  return (
    <div className="flex items-center gap-3 py-3">
      <Crown className="text-dusk-ink size-5" />
      <div className="flex-1">
        <p className="text-foreground text-base font-medium">
          {premium ? "Hamkke Premium" : "무료 플랜"}
        </p>
        <p className="text-muted-foreground text-sm">
          {premium ? "두 사람 모두 프리미엄 혜택을 받고 있어요" : "사진·캡슐·만남 지도 한도 있음"}
        </p>
      </div>
      {premium ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => portalMutation.mutate()}
          disabled={portalMutation.isPending}
        >
          구독 관리
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={() => checkoutMutation.mutate()}
          disabled={checkoutMutation.isPending}
        >
          프리미엄
        </Button>
      )}
    </div>
  );
}
