"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { isAtLimit, isNearLimit } from "@/lib/plan-usage";
import { useTRPC } from "@/trpc/client";
import { useCanCheckoutHere, useStartCheckout } from "./use-start-checkout";

type UsageKey = "moments" | "activeCapsules" | "meetupPins";

type T = ReturnType<typeof useTranslations<"upgrade">>;

function message(t: T, key: UsageKey, used: number, limit: number, atLimit: boolean) {
  if (key === "meetupPins") {
    // 만남 지도는 막지 않고, 최근 N곳 밖은 지우지 않고 숨긴다(meetup 라우터).
    return atLimit ? t("pinsAtLimit", { limit }) : t("pinsNear", { limit, used });
  }
  const noun = t(key === "moments" ? "nounMoments" : "nounCapsules");
  return atLimit ? t("atLimit", { noun, limit }) : t("near", { noun, used, limit });
}

// 한도 근처 업그레이드 안내(PRD §3.5). 한도의 80%를 넘었을 때만, 그 기능을
// 쓰는 시트 안에서 한 줄로 - 팝업·전면 업셀은 하지 않는다(Calm Technology).
export function UpgradeHint({ usageKey }: { usageKey: UsageKey }) {
  const trpc = useTRPC();
  const t = useTranslations("upgrade");
  // 시트를 열 때마다 새로 센다(방금 올린 사진이 반영되게).
  const { data } = useQuery({ ...trpc.billing.usage.queryOptions(), refetchOnMount: "always" });
  const checkout = useStartCheckout();
  const canCheckout = useCanCheckoutHere();

  const item = data && !data.premium ? data.items.find((i) => i.key === usageKey) : undefined;
  if (!item || !isNearLimit(item)) return null;

  return (
    <p className="text-muted-foreground text-sm">
      {message(t, usageKey, item.used, item.limit, isAtLimit(item))}.{" "}
      {/* 유료 플랜이 닫혀 있으면 곧 열린다고만, 이 앱에서 살 수 없는 사용자에게는
          한도만 말하고 권유하지 않는다(use-start-checkout.ts). */}
      {!data?.open ? (
        t("soon")
      ) : !canCheckout ? null : (
        <button
          type="button"
          className="text-primary font-semibold underline-offset-4 hover:underline"
          disabled={checkout.pending}
          onClick={() => void checkout.start()}
        >
          {t("unlimited")}
        </button>
      )}
    </p>
  );
}
