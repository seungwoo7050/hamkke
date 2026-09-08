"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronRight, Gift, Mail } from "lucide-react";
import { daysUntil, nextOccurrence } from "@/lib/anniversary";
import { selectContextCards, type ContextCard } from "@/lib/context-cards";
import { josa } from "@/lib/josa";
import { useHydrated } from "@/lib/use-hydrated";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { formatDday } from "./countdown-tracker";
import { displayName, useSpace } from "./space-context";

// 캡슐이 "새로 도착했다"고 보여줄 기간 — 그 뒤엔 기억 › 지나온에만 남는다.
const CAPSULE_FRESH_MS = 24 * 60 * 60 * 1000;

function Card({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="bg-muted hover:bg-muted/70 duration-fast ease-standard flex items-center gap-3 rounded-lg px-4 py-3.5 transition-colors"
    >
      <span className="text-dusk-ink shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-base font-semibold">{title}</span>
        <span className="text-muted-foreground block truncate text-sm">{sub}</span>
      </span>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" />
    </Link>
  );
}

// "우리" 탭 상황 카드 — 지금 이 커플에게 해당하는 것만, 최대 2장
// (선택 규칙은 src/lib/context-cards.ts).
export function ContextCards() {
  const trpc = useTRPC();
  const { currentUserId, summary } = useSpace();
  const hydrated = useHydrated();
  const now = useNow();
  const partnerName = displayName(summary.partner, "상대");

  const anniversaries = useQuery(trpc.anniversary.list.queryOptions());
  const countdowns = useQuery(trpc.countdown.list.queryOptions());
  const capsules = useQuery(trpc.capsule.list.queryOptions());

  const cards = useMemo(() => {
    const todayAnniversaries = (anniversaries.data ?? [])
      .filter((a) => daysUntil(nextOccurrence(new Date(a.date), a.recurring, now), now) === 0)
      .map((a) => a.title);
    const arrivedCapsules = (capsules.data ?? []).filter(
      (c) =>
        c.senderId !== currentUserId &&
        c.deliveredAt &&
        now.getTime() - new Date(c.deliveredAt).getTime() < CAPSULE_FRESH_MS,
    ).length;
    const nextCountdown =
      (countdowns.data ?? [])
        .map((c) => ({ title: c.title, days: daysUntil(new Date(c.targetDate), now) }))
        .filter((c) => c.days >= 0)
        .sort((a, b) => a.days - b.days)[0] ?? null;

    return selectContextCards({
      todayAnniversaries,
      arrivedCapsules,
      pendingQuestion: null,
      nextCountdown,
    });
  }, [anniversaries.data, capsules.data, countdowns.data, currentUserId, now]);

  if (!hydrated || cards.length === 0) return null;

  function render(card: ContextCard) {
    switch (card.kind) {
      case "anniversary":
        return (
          <Card
            key={`a-${card.title}`}
            href="/home/memories"
            icon={<Gift className="size-6" />}
            title={`오늘은 ${card.title}`}
            sub={`${partnerName}에게 한마디 남겨볼까요`}
          />
        );
      case "capsule":
        return (
          <Card
            key="capsule"
            href="/home/memories?tab=past"
            icon={<Mail className="size-6" />}
            title={`${josa(partnerName, "이/가")} 보낸 캡슐이 열렸어요`}
            sub={card.count > 1 ? `${card.count}통이 도착했어요` : "지금 열어볼 수 있어요"}
          />
        );
      case "countdown":
        return (
          <Card
            key="countdown"
            href="/home/memories"
            icon={<Calendar className="size-6" />}
            title={`${card.title}까지 ${formatDday(card.days)}`}
            sub="기억 탭에서 일정·캡슐을 준비해요"
          />
        );
      case "question":
        return null;
    }
  }

  return <section className="mt-8 flex flex-col gap-3 px-4">{cards.map(render)}</section>;
}
