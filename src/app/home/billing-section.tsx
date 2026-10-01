"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/i18n/use-format";
import { isNearLimit } from "@/lib/plan-usage";
import { useTRPC } from "@/trpc/client";

// 구독 시작은 Checkout, 해지/결제수단 변경은 Customer Portal로 위임한다
// (ARCHITECTURE.md §6 - 자체 UI로 결제 로직을 구현하지 않는다). 설정성
// 기능이라 홈이 아니라 설정 시트의 한 줄로 둔다(DESIGN.md §4).
export function BillingSection() {
  const trpc = useTRPC();
  const t = useTranslations("billing");
  const fmt = useFormat();
  const { data: subscription } = useQuery(trpc.billing.status.queryOptions());
  const { data: usage } = useQuery(trpc.billing.usage.queryOptions());
  const checkoutMutation = useMutation(
    trpc.billing.createCheckoutSession.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.assign(url);
      },
      onError: (err) =>
        toast.error(err.data?.code === "TOO_MANY_REQUESTS" ? err.message : t("checkoutFailed")),
    }),
  );
  const portalMutation = useMutation(
    trpc.billing.createPortalSession.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.assign(url);
      },
      onError: (err) =>
        toast.error(err.data?.code === "TOO_MANY_REQUESTS" ? err.message : t("portalFailed")),
    }),
  );

  const premium = subscription?.status === "active";
  // 유료 플랜이 닫혀 있으면(src/lib/plan.ts isPremiumOpen) 결제 버튼 대신 곧 열린다고만.
  // 사용량을 받기 전에는 버튼을 내지 않는다 - 닫혀 있을 때 잠깐 보였다 사라지지 않게.
  const open = usage?.open === true;

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <Crown className="text-dusk-ink size-5" />
        <div className="flex-1">
          <p className="text-foreground text-base font-medium">
            {premium ? t("premium") : t("free")}
          </p>
          <p className="text-muted-foreground text-sm">
            {premium ? t("premiumSub") : t("freeSub")}
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
            {t("manage")}
          </Button>
        ) : open ? (
          <Button
            type="button"
            size="sm"
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
          >
            {t("upgrade")}
          </Button>
        ) : usage ? (
          <span className="text-muted-foreground text-sm">{t("soon")}</span>
        ) : null}
      </div>
      {usage && (
        // 한도에 부딪힌 뒤 토스트로 알던 걸 미리 보이게(PRD §3.5). 한도 근처면
        // 숫자만 ember로 - 경고 배너 대신 조용하게. 저장 공간은 프리미엄에도 상한이
        // 있어 두 요금제 모두 보여 준다.
        <dl className="mt-3 ml-8 flex flex-col gap-2">
          {[
            ...(usage.premium ? [] : usage.items).map((item) => ({
              key: item.key,
              item,
              value: `${item.used}/${item.limit}`,
            })),
            {
              key: "storage" as const,
              item: usage.storage,
              value: `${fmt.bytes(usage.storage.used)} / ${fmt.bytes(usage.storage.limit)}`,
            },
          ].map(({ key, item, value }) => {
            const near = isNearLimit(item);
            return (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">{t(`usage.${key}`)}</dt>
                  <dd className={near ? "text-primary font-semibold" : "text-foreground"}>
                    {value}
                  </dd>
                </div>
                <div className="bg-muted h-1 overflow-hidden rounded-full" aria-hidden>
                  <div
                    className={`duration-slow ease-standard h-full rounded-full transition-[width] ${near ? "bg-primary" : "bg-dusk-ink/50"}`}
                    style={{ width: `${Math.min(100, (item.used / item.limit) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
