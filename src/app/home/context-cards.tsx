"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CalendarHeart,
  ChevronRight,
  Gift,
  Mail,
  MessageCircleQuestion,
  PlaneLanding,
  PlaneTakeoff,
} from "lucide-react";
import { dateOnly, daysBetween, formatTime, nextOccurrence, todayIn } from "@/lib/datetime";
import { bestTimes, pickFlight } from "@/lib/flight";
import { selectContextCards, type ContextCard } from "@/lib/context-cards";
import { josa } from "@/lib/josa";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { formatDday } from "./countdown-tracker";
import { QuestionSheet, useTodayQuestion } from "./daily-question";
import { useFlights, type FlightView } from "./flights";
import { displayName, useMyTimeZone, useSpace } from "./space-context";

// 캡슐이 "새로 도착했다"고 보여줄 기간 — 그 뒤엔 기억 › 지나온에만 남는다.
const CAPSULE_FRESH_MS = 24 * 60 * 60 * 1000;

const CARD_CLASS =
  "bg-muted hover:bg-muted/70 duration-fast ease-standard flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left transition-colors";

function CardBody({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <>
      <span className="text-dusk-ink shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-base font-semibold">{title}</span>
        <span className="text-muted-foreground block truncate text-sm">{sub}</span>
      </span>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" />
    </>
  );
}

function Card({ href, ...body }: { href: string } & React.ComponentProps<typeof CardBody>) {
  return (
    <Link href={href} className={CARD_CLASS}>
      <CardBody {...body} />
    </Link>
  );
}

// "우리" 탭 상황 카드 — 지금 이 커플에게 해당하는 것만, 최대 2장
// (선택 규칙은 src/lib/context-cards.ts).
export function ContextCards() {
  const trpc = useTRPC();
  const { currentUserId, summary } = useSpace();
  const myTz = useMyTimeZone();
  const now = useNow();
  const partnerName = displayName(summary.partner, "상대");

  const anniversaries = useQuery(trpc.anniversary.list.queryOptions());
  const countdowns = useQuery(trpc.countdown.list.queryOptions());
  const capsules = useQuery(trpc.capsule.list.queryOptions());
  const question = useTodayQuestion();
  const flights = useFlights();
  const [questionOpen, setQuestionOpen] = useState(false);

  const picked = flights.data ? pickFlight(flights.data, now) : null;
  const flightCard = picked
    ? {
        kind:
          picked.phase === "inFlight"
            ? ("flight-inflight" as const)
            : picked.phase === "arrived"
              ? ("flight-arrived" as const)
              : ("flight-departing" as const),
        flightId: picked.flight.id,
      }
    : null;

  const cards = useMemo(() => {
    const today = todayIn(myTz, now);
    const todayAnniversaries = (anniversaries.data ?? [])
      .filter((a) => daysBetween(today, nextOccurrence(dateOnly(a.date), a.recurring, today)) === 0)
      .map((a) => a.title);
    const arrivedCapsules = (capsules.data ?? []).filter(
      (c) =>
        c.senderId !== currentUserId &&
        c.deliveredAt &&
        now.getTime() - new Date(c.deliveredAt).getTime() < CAPSULE_FRESH_MS,
    ).length;
    const upcomingCountdowns = (countdowns.data ?? []).filter(
      (c) => daysBetween(today, dateOnly(c.targetDate)) >= 0,
    );
    const nextCountdown =
      upcomingCountdowns
        .map((c) => ({ title: c.title, days: daysBetween(today, dateOnly(c.targetDate)) }))
        .sort((a, b) => a.days - b.days)[0] ?? null;

    return selectContextCards({
      flight: flightCard,
      todayAnniversaries,
      arrivedCapsules,
      pendingQuestion:
        question.data && !question.data.myAnswer
          ? { partnerAnswered: question.data.partnerAnswered }
          : null,
      nextCountdown,
      // 두 목록을 다 불러온 뒤에만 판단한다(불러오는 중에 "비어 있음"으로 오판하지 않게).
      setup:
        anniversaries.data && countdowns.data
          ? {
              needsAnniversary: anniversaries.data.length === 0,
              needsMeetupDate: upcomingCountdowns.length === 0,
            }
          : undefined,
    });
    // flightCard는 flights.data·now에서 매 렌더 새로 만들어지므로 그 원천을 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    anniversaries.data,
    capsules.data,
    countdowns.data,
    question.data,
    flights.data,
    currentUserId,
    now,
    myTz,
  ]);

  const sheet = <QuestionSheet open={questionOpen} onOpenChange={setQuestionOpen} />;
  if (cards.length === 0) return sheet;

  function render(card: ContextCard) {
    switch (card.kind) {
      case "flight-inflight":
      case "flight-arrived":
      case "flight-departing": {
        const f = flights.data?.find((x) => x.id === card.flightId);
        if (!f) return null;
        return <FlightCard key={card.kind} kind={card.kind} flight={f} />;
      }
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
      case "setup-meetup":
        return (
          <Card
            key="setup-meetup"
            href="/home/memories?add=countdown"
            icon={<CalendarHeart className="size-6" />}
            title="다음에 만나는 날을 정해볼까요"
            sub="정해두면 여기서 D-day를 세어줄게요"
          />
        );
      case "setup-anniversary":
        return (
          <Card
            key="setup-anniversary"
            href="/home/memories?add=anniversary"
            icon={<Gift className="size-6" />}
            title="처음 만난 날을 적어주세요"
            sub="기념일이 되면 여기서 먼저 알려줄게요"
          />
        );
      case "question":
        return (
          <button
            key="question"
            type="button"
            className={CARD_CLASS}
            onClick={() => setQuestionOpen(true)}
          >
            <CardBody
              icon={<MessageCircleQuestion className="size-6" />}
              title="오늘의 질문"
              sub={
                card.partnerAnswered
                  ? `${josa(partnerName, "은/는")} 답했어요 · 내가 답하면 볼 수 있어요`
                  : (question.data?.question.text ?? "")
              }
            />
          </button>
        );
    }
  }

  return (
    <>
      <section className="mt-8 flex flex-col gap-3 px-4">{cards.map(render)}</section>
      {sheet}
    </>
  );
}

// 비행 카드(PRD §3.3.1). 실제 이륙·착륙을 모르므로(무료 범위) 도착은 "도착했을
// 시간이에요"라고 말하고, 시각은 그 공항 현지 시각으로 적는다.
function FlightCard({
  kind,
  flight: f,
}: {
  kind: "flight-inflight" | "flight-arrived" | "flight-departing";
  flight: FlightView;
}) {
  const trpc = useTRPC();
  const { currentUserId, summary } = useSpace();
  const now = useNow();
  const capsules = useQuery(trpc.capsule.list.queryOptions());
  const mine = f.travelerId === currentUserId;
  const name = displayName(summary.partner, "상대");
  const { departureAt, arrivalAt, estimated } = bestTimes(f);
  const letters = (capsules.data ?? []).filter(
    (c) => c.flightId === f.id && new Date(c.deliverAt) > now,
  ).length;
  // 착륙 편지는 타는 사람에게 남기는 것 — 내가 타는 비행이면 권하지 않는다.
  const letterHint = mine
    ? null
    : letters > 0
      ? `편지 ${letters}통이 착륙을 기다려요`
      : "착륙 편지를 남겨둘 수 있어요";
  const withHint = (text: string) => (letterHint ? `${text} · ${letterHint}` : text);

  if (kind === "flight-inflight") {
    return (
      <Card
        href="/home/memories"
        icon={<PlaneLanding className="size-6" />}
        title={`도착하면 거기는 ${formatTime(arrivalAt, f.to.timeZone)}`}
        sub={withHint(`${f.to.name} 도착${estimated ? " 예정" : ""}`)}
      />
    );
  }
  if (kind === "flight-arrived") {
    return (
      <Card
        href="/home/memories?tab=past"
        icon={<PlaneLanding className="size-6" />}
        title={
          mine
            ? `${f.to.city}에 도착했을 시간이에요`
            : `${josa(name, "이/가")} ${f.to.city}에 도착했을 시간이에요`
        }
        sub={`${formatTime(arrivalAt, f.to.timeZone)} 착륙 ${estimated ? "예정이었어요" : "했어요"}`}
      />
    );
  }
  const depToday = todayIn(f.from.timeZone, departureAt);
  const dayWord = daysBetween(todayIn(f.from.timeZone, now), depToday) === 0 ? "오늘" : "내일";
  return (
    <Card
      href="/home/memories"
      icon={<PlaneTakeoff className="size-6" />}
      title={`${mine ? "" : `${josa(name, "이/가")} `}${dayWord} ${formatTime(departureAt, f.from.timeZone)}에 출발해요`}
      sub={withHint(`${f.flightNumber} ${f.from.city} → ${f.to.city}`)}
    />
  );
}
