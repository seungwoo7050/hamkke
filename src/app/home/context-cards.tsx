"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarHeart,
  ChevronRight,
  Gift,
  MessageCircleQuestion,
  PlaneLanding,
  PlaneTakeoff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { SpotArt } from "@/components/brand/spot-art";
import { useFormat } from "@/i18n/use-format";
import { dateOnly, daysBetween, nextOccurrence, todayIn } from "@/lib/datetime";
import { bestTimes, pickFlight } from "@/lib/flight";
import { selectContextCards, type ContextCard } from "@/lib/context-cards";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { QuestionSheet, useTodayQuestion } from "./daily-question";
import { useFlights, type FlightView } from "./flights";
import { useMyTimeZone, usePartnerName, useSpace } from "./space-context";

// 캡슐이 "새로 도착했다"고 보여줄 기간 - 그 뒤엔 기억 › 지나온에만 남는다.
const CAPSULE_FRESH_MS = 24 * 60 * 60 * 1000;

const CARD_CLASS =
  "bg-muted hover:bg-muted/70 duration-fast ease-standard flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left transition-colors";

function CardBody({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <>
      {/* 아이콘(24px)과 스팟 그림(40px)이 섞여도 제목이 같은 선에서 시작하게 40px 상자에 둔다. */}
      <span className="text-dusk-ink flex size-10 shrink-0 items-center justify-center">
        {icon}
      </span>
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

// "우리" 탭 상황 카드 - 지금 이 커플에게 해당하는 것만, 최대 2장
// (선택 규칙은 src/lib/context-cards.ts).
export function ContextCards() {
  const trpc = useTRPC();
  const { currentUserId } = useSpace();
  const t = useTranslations("cards");
  const fmt = useFormat();
  const myTz = useMyTimeZone();
  const now = useNow();
  const partnerName = usePartnerName();
  const names = fmt.particles(partnerName);

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

  // 새로 도착한 캡슐 중 착륙 편지가 있으면 카드에서 그렇게 부른다.
  const landingArrived = (capsules.data ?? []).some(
    (c) =>
      c.flightId &&
      c.senderId !== currentUserId &&
      c.deliveredAt &&
      now.getTime() - new Date(c.deliveredAt).getTime() < CAPSULE_FRESH_MS,
  );
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
            icon={<SpotArt spot="together" />}
            title={t("anniversaryTitle", { title: card.title })}
            sub={t("anniversarySub", { name: partnerName })}
          />
        );
      case "capsule":
        return (
          <Card
            key="capsule"
            href="/home/memories?tab=past"
            icon={<SpotArt spot="letter" />}
            title={t(landingArrived ? "landingLetterTitle" : "capsuleTitle", names)}
            sub={card.count > 1 ? t("capsuleMany", { count: card.count }) : t("capsuleOne")}
          />
        );
      case "countdown":
        return (
          <Card
            key="countdown"
            href="/home/memories"
            icon={<SpotArt spot="soon" />}
            title={t("countdownTitle", { title: card.title, dday: fmt.ddayBig(card.days) })}
            sub={t("countdownSub")}
          />
        );
      case "setup-meetup":
        return (
          <Card
            key="setup-meetup"
            href="/home/memories?add=countdown"
            icon={<CalendarHeart className="size-6" />}
            title={t("setupMeetupTitle")}
            sub={t("setupMeetupSub")}
          />
        );
      case "setup-anniversary":
        return (
          <Card
            key="setup-anniversary"
            href="/home/memories?add=anniversary"
            icon={<Gift className="size-6" />}
            title={t("setupAnniversaryTitle")}
            sub={t("setupAnniversarySub")}
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
              title={t("questionTitle")}
              sub={
                card.partnerAnswered
                  ? t("questionPartnerAnswered", names)
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
  const { currentUserId } = useSpace();
  const t = useTranslations("cards");
  const fmt = useFormat();
  const now = useNow();
  const capsules = useQuery(trpc.capsule.list.queryOptions());
  const mine = f.travelerId === currentUserId;
  const names = fmt.particles(usePartnerName());
  const { departureAt, arrivalAt, estimated } = bestTimes(f);
  const letters = (capsules.data ?? []).filter(
    (c) => c.flightId === f.id && new Date(c.deliverAt) > now,
  ).length;
  const sentLetters = (capsules.data ?? []).filter(
    (c) => c.flightId === f.id && c.senderId === currentUserId,
  ).length;
  // 착륙 편지는 타는 사람에게 남기는 것 - 내가 타는 비행이면 권하지 않는다.
  const letterHint = mine
    ? null
    : letters > 0
      ? t("lettersWaiting", { count: letters })
      : t("leaveLetter");
  const withHint = (text: string) => (letterHint ? `${text} · ${letterHint}` : text);

  const letterHref = mine ? "/home/memories" : `/home/memories?add=capsule&flight=${f.id}`;
  if (kind === "flight-inflight") {
    return (
      <Card
        href={letterHref}
        icon={<PlaneLanding className="size-6" />}
        title={t("flightLandsAt", { time: fmt.time(arrivalAt, f.to.timeZone) })}
        sub={withHint(
          // 한국어는 공항 이름, 영어는 더 짧은 도시 이름을 쓴다(잘리면 편지 안내가 가려짐).
          t(estimated ? "flightArrivingScheduled" : "flightArriving", {
            airport: f.to.name,
            city: f.to.city,
          }),
        )}
      />
    );
  }
  if (kind === "flight-arrived") {
    return (
      <Card
        href="/home/memories?tab=past"
        icon={<SpotArt spot="apart" />}
        title={t(mine ? "arrivedMine" : "arrivedPartner", { ...names, city: f.to.city })}
        sub={[
          t(estimated ? "arrivedScheduled" : "arrivedActual", {
            time: fmt.time(arrivalAt, f.to.timeZone),
          }),
          sentLetters > 0 && t("letterOpened"),
        ]
          .filter(Boolean)
          .join(" · ")}
      />
    );
  }
  const depToday = todayIn(f.from.timeZone, departureAt);
  const day = daysBetween(todayIn(f.from.timeZone, now), depToday) === 0 ? "today" : "tomorrow";
  return (
    <Card
      href={letterHref}
      icon={<PlaneTakeoff className="size-6" />}
      title={t(mine ? "departingMine" : "departingPartner", {
        ...names,
        day,
        time: fmt.time(departureAt, f.from.timeZone),
      })}
      sub={withHint(`${f.flightNumber} ${f.from.city} → ${f.to.city}`)}
    />
  );
}
