"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { type Formatters } from "@/i18n/format";
import { useFormat } from "@/i18n/use-format";
import { daysBetween, todayIn } from "@/lib/datetime";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, Row, Section } from "./memories/section";
import { useMyTimeZone, usePartnerName, useSpace } from "./space-context";

// datetime-local input은 "YYYY-MM-DDTHH:mm"를 로컬 시간 기준으로 받는다
// (toISOString()은 UTC라 그대로 쓰면 시간대만큼 어긋난다).
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hoursFromNow(h: number) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + h);
  return toLocalInputValue(d);
}

// 상대 쪽은 시각만 - 날짜가 내 쪽과 달라질 때만 요일을 붙인다(한 줄에 담기게).
function formatPartner(fmt: Formatters, date: Date, myTz: string, partnerTz: string) {
  const mine = todayIn(myTz, date);
  const theirs = todayIn(partnerTz, date);
  const time = fmt.time(date, partnerTz);
  return daysBetween(mine, theirs) === 0 ? time : `${fmt.weekday(theirs)} ${time}`;
}

// 달력 그리드 대신 다가오는 순 리스트로 단순화했다(PRD.md §3.4 범위).
// 같은 일정을 두 사람 시간대로 나란히 보여준다 - "양쪽 시간대 자동 변환".
export function CalendarView() {
  const trpc = useTRPC();
  const myTz = useMyTimeZone();
  const { summary } = useSpace();
  const partnerTz = summary.partner?.timezone ?? null;
  const partnerName = usePartnerName();
  const t = useTranslations("calendar");
  const tm = useTranslations("memories");
  const fmt = useFormat();

  const listQuery = useQuery(trpc.calendar.list.queryOptions());
  const deleteMutation = useMutation(
    trpc.calendar.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const now = useNow();
  const upcoming = useMemo(
    () => (listQuery.data ?? []).filter((e) => new Date(e.endAt) >= now),
    [listQuery.data, now],
  );

  return (
    <Section
      title={t("title")}
      addTitle={t("addTitle")}
      renderAdd={(close) => <CalendarForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : upcoming.length === 0 ? (
        <EmptyRow>{t("empty")}</EmptyRow>
      ) : (
        upcoming.map((event) => {
          const start = new Date(event.startAt);
          const mine = fmt.dateTime(start, myTz);
          const theirs =
            partnerTz && partnerTz !== myTz
              ? ` · ${t("partnerTime", {
                  name: partnerName,
                  time: formatPartner(fmt, start, myTz, partnerTz),
                })}`
              : "";
          return (
            <Row
              key={event.id}
              icon={<Calendar className="text-dusk-ink size-5" />}
              title={event.title}
              sub={`${mine}${theirs}`}
              end={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tm("delete", { title: event.title })}
                  className="text-muted-foreground"
                  onClick={() => deleteMutation.mutate({ id: event.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          );
        })
      )}
    </Section>
  );
}

function CalendarForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const trpc = useTRPC();
  const t = useTranslations("calendar");
  const tm = useTranslations("memories");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(() => hoursFromNow(1));
  const [endAt, setEndAt] = useState(() => hoursFromNow(2));
  // 시작을 옮기면 끝도 같은 길이만큼 따라 옮긴다 - 날짜를 바꿨는데 끝이 그대로면
  // "끝이 시작보다 앞"이 되어 저장이 거절됐다(실제 검증 중 발견).
  function changeStart(next: string) {
    const duration = new Date(endAt).getTime() - new Date(startAt).getTime();
    setStartAt(next);
    setEndAt(toLocalInputValue(new Date(new Date(next).getTime() + Math.max(duration, 0))));
  }

  const createMutation = useMutation(
    trpc.calendar.create.mutationOptions({
      onSuccess: () => {
        onCreated();
        onDone();
      },
      onError: () => toast.error(t("saveFailed")),
    }),
  );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        createMutation.mutate({
          title: title.trim(),
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }}
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("placeholder")}
      />
      <DateTimeField label={t("start")} value={startAt} onChange={changeStart} />
      <DateTimeField label={t("end")} value={endAt} onChange={setEndAt} />
      <Button type="submit" size="lg" disabled={!title.trim() || createMutation.isPending}>
        {tm("add")}
      </Button>
    </form>
  );
}
