"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pickFlight } from "@/lib/flight";
import { useFormat } from "@/i18n/use-format";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { useFlights } from "./flights";
import { useSpaceBroadcast } from "./realtime-context";
import { usePartnerName, useSpace } from "./space-context";

const SENT_FEEDBACK_MS = 2400;

// "생각하고 있어요" — 이 앱의 주인공(DESIGN.md §2 Minimal Intimate Objects).
// 1비트 신호라도 받은 사실이 드러나야 친밀감 채널로 기능하므로(Kaye, CHI '05)
// 마지막으로 받은 시각을 버튼 바로 아래 손글씨로 상시 보여준다.
export function TouchHero() {
  const trpc = useTRPC();
  const { currentUserId, summary } = useSpace();
  const now = useNow();
  const t = useTranslations("touch");
  const fmt = useFormat();
  const partnerName = usePartnerName();
  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(
    summary.lastTouchReceivedAt ? new Date(summary.lastTouchReceivedAt) : null,
  );
  const [justSent, setJustSent] = useState(false);
  const flights = useFlights();
  const picked = flights.data ? pickFlight(flights.data, now) : null;
  const partnerFlying = picked?.phase === "inFlight" && picked.flight.travelerId !== currentUserId;

  const sendMutation = useMutation(
    trpc.touch.send.mutationOptions({
      onSuccess: () => setJustSent(true),
      onError: () => toast.error(t("failed")),
    }),
  );

  useEffect(() => {
    if (!justSent) return;
    const id = setTimeout(() => setJustSent(false), SENT_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [justSent]);

  useSpaceBroadcast<{ senderId: string; createdAt: string }>("touch", ({ senderId, createdAt }) => {
    if (senderId !== currentUserId) setLastReceivedAt(new Date(createdAt));
  });

  return (
    <section aria-label={t("label")} className="mt-6 px-4">
      <Button
        type="button"
        size="lg"
        className="w-full text-base"
        disabled={sendMutation.isPending}
        onClick={() => sendMutation.mutate()}
      >
        <Heart className="size-6" />
        {justSent ? t("sent", { name: partnerName }) : t("send")}
      </Button>
      <p className="font-handwritten text-dusk-ink mt-2.5 min-h-7 text-lg" suppressHydrationWarning>
        {partnerFlying
          ? // 비행 중엔 인터넷이 없을 수 있다 — 보낸 마음이 사라지지 않는다는 걸 먼저 말한다.
            t("partnerFlying")
          : lastReceivedAt
            ? t("lastReceived", {
                ...fmt.particles(partnerName),
                when: fmt.relativeAdverb(lastReceivedAt, now),
              })
            : t("empty", { name: partnerName })}
      </p>
    </section>
  );
}
