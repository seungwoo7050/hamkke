"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { isAtLimit, isNearLimit } from "@/lib/plan-usage";
import { useTRPC } from "@/trpc/client";

type UsageKey = "moments" | "activeCapsules" | "meetupPins";

type T = ReturnType<typeof useTranslations<"upgrade">>;

function message(t: T, key: UsageKey, used: number, limit: number, atLimit: boolean) {
  if (key === "meetupPins") {
    // 만남 지도는 막지 않고 오래된 곳부터 정리한다(meetup 라우터).
    return atLimit ? t("pinsAtLimit", { limit }) : t("pinsNear", { limit, used });
  }
  const noun = t(key === "moments" ? "nounMoments" : "nounCapsules");
  return atLimit ? t("atLimit", { noun, limit }) : t("near", { noun, used, limit });
}

// 한도 근처 업그레이드 안내(PRD §3.5). 한도의 80%를 넘었을 때만, 그 기능을
// 쓰는 시트 안에서 한 줄로 — 팝업·전면 업셀은 하지 않는다(Calm Technology).
export function UpgradeHint({ usageKey }: { usageKey: UsageKey }) {
  const trpc = useTRPC();
  const t = useTranslations("upgrade");
  const tb = useTranslations("billing");
  // 시트를 열 때마다 새로 센다(방금 올린 사진이 반영되게).
  const { data } = useQuery({ ...trpc.billing.usage.queryOptions(), refetchOnMount: "always" });
  const checkout = useMutation(
    trpc.billing.createCheckoutSession.mutationOptions({
      onSuccess: ({ url }) => window.location.assign(url),
      onError: () => toast.error(tb("checkoutFailed")),
    }),
  );

  const item = data && !data.premium ? data.items.find((i) => i.key === usageKey) : undefined;
  if (!item || !isNearLimit(item)) return null;

  return (
    <p className="text-muted-foreground text-sm">
      {message(t, usageKey, item.used, item.limit, isAtLimit(item))}.{" "}
      <button
        type="button"
        className="text-primary font-semibold underline-offset-4 hover:underline"
        disabled={checkout.isPending}
        onClick={() => checkout.mutate()}
      >
        {t("unlimited")}
      </button>
    </p>
  );
}
