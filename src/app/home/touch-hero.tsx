"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { josa } from "@/lib/josa";
import { relativeTimeAdverb } from "@/lib/relative-time";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spaceChannelName } from "@/lib/supabase/channels";
import { useHydrated } from "@/lib/use-hydrated";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { displayName, useSpace } from "./space-context";

const SENT_FEEDBACK_MS = 2400;

// "생각하고 있어요" — 이 앱의 주인공(DESIGN.md §2 Minimal Intimate Objects).
// 1비트 신호라도 받은 사실이 드러나야 친밀감 채널로 기능하므로(Kaye, CHI '05)
// 마지막으로 받은 시각을 버튼 바로 아래 손글씨로 상시 보여준다.
export function TouchHero() {
  const trpc = useTRPC();
  const { spaceId, currentUserId, summary } = useSpace();
  const hydrated = useHydrated();
  const now = useNow();
  const partnerName = displayName(summary.partner, "상대");
  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(
    summary.lastTouchReceivedAt ? new Date(summary.lastTouchReceivedAt) : null,
  );
  const [justSent, setJustSent] = useState(false);

  const sendMutation = useMutation(
    trpc.touch.send.mutationOptions({
      onSuccess: () => setJustSent(true),
      onError: () => toast.error("전하지 못했어요. 잠시 뒤 다시 눌러주세요"),
    }),
  );

  useEffect(() => {
    if (!justSent) return;
    const id = setTimeout(() => setJustSent(false), SENT_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [justSent]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(spaceChannelName(spaceId))
      .on("broadcast", { event: "touch" }, (msg) => {
        const { senderId, createdAt } = msg.payload as { senderId: string; createdAt: string };
        if (senderId !== currentUserId) setLastReceivedAt(new Date(createdAt));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId]);

  return (
    <section aria-label="생각하고 있어요 보내기" className="mt-6 px-4">
      <Button
        type="button"
        size="lg"
        className="w-full text-base"
        disabled={sendMutation.isPending}
        onClick={() => sendMutation.mutate()}
      >
        <Heart className="size-6" />
        {justSent ? `${partnerName}에게 전했어요` : "생각하고 있어요"}
      </Button>
      <p className="font-handwritten text-dusk-ink mt-2.5 min-h-7 text-lg">
        {hydrated &&
          (lastReceivedAt
            ? `${relativeTimeAdverb(lastReceivedAt, now)} ${josa(partnerName, "이/가")} 생각해줬어요`
            : `생각날 때 눌러보세요. ${partnerName}에게 바로 닿아요`)}
      </p>
    </section>
  );
}
