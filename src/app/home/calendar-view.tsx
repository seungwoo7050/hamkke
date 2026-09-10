"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysBetween, formatDateTime, formatTime, todayIn, weekdayOf } from "@/lib/datetime";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, Row, Section } from "./memories/section";
import { displayName, useMyTimeZone, useSpace } from "./space-context";

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

// 상대 쪽은 시각만 — 날짜가 내 쪽과 달라질 때만 요일을 붙인다(한 줄에 담기게).
function formatPartner(date: Date, myTz: string, partnerTz: string) {
  const mine = todayIn(myTz, date);
  const theirs = todayIn(partnerTz, date);
  const time = formatTime(date, partnerTz);
  return daysBetween(mine, theirs) === 0 ? time : `${weekdayOf(theirs)} ${time}`;
}

// 달력 그리드 대신 다가오는 순 리스트로 단순화했다(PRD.md §3.4 범위).
// 같은 일정을 두 사람 시간대로 나란히 보여준다 — "양쪽 시간대 자동 변환".
export function CalendarView() {
  const trpc = useTRPC();
  const myTz = useMyTimeZone();
  const { summary } = useSpace();
  const partnerTz = summary.partner?.timezone ?? null;
  const partnerName = displayName(summary.partner, "상대");

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
      title="일정"
      addTitle="일정 추가"
      renderAdd={(close) => <CalendarForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {upcoming.length === 0 ? (
        <EmptyRow>영상통화 데이트 같은 약속을 잡아보세요</EmptyRow>
      ) : (
        upcoming.map((event) => {
          const start = new Date(event.startAt);
          const mine = formatDateTime(start, myTz);
          const theirs =
            partnerTz && partnerTz !== myTz
              ? ` · ${partnerName} ${formatPartner(start, myTz, partnerTz)}`
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
                  aria-label={`${event.title} 삭제`}
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
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(() => hoursFromNow(1));
  const [endAt, setEndAt] = useState(() => hoursFromNow(2));
  const createMutation = useMutation(
    trpc.calendar.create.mutationOptions({
      onSuccess: () => {
        onCreated();
        onDone();
      },
      onError: () => toast.error("일정 저장에 실패했어요(종료 시각을 확인해주세요)"),
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
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 영상통화" />
      <label className="text-muted-foreground flex flex-col gap-1 text-sm">
        시작
        <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
      </label>
      <label className="text-muted-foreground flex flex-col gap-1 text-sm">
        끝
        <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
      </label>
      <Button type="submit" size="lg" disabled={!title.trim() || createMutation.isPending}>
        추가
      </Button>
    </form>
  );
}
