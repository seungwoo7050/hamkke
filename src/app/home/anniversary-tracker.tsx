"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Gift, Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { dateOnly, daysBetween, formatYMD, nextOccurrence, todayIn } from "@/lib/datetime";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { formatDday } from "./countdown-tracker";
import { EmptyRow, LoadingRow, Row, Section } from "./memories/section";
import { useMyTimeZone } from "./space-context";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

// 정확한 시각 push 스케줄러가 아직 없어(docs/COMMIT_PLAN.md Phase 4 각주)
// "다가오는 기념일"은 매 렌더링마다 내 시간대의 오늘 기준으로 다시
// 계산한다(src/lib/datetime.ts). 지난 단발 기념일은 "다가올"에서 뺀다.
export function AnniversaryTracker({ openAdd = false }: { openAdd?: boolean }) {
  const trpc = useTRPC();
  const myTz = useMyTimeZone();
  const now = useNow();
  const listQuery = useQuery(trpc.anniversary.list.queryOptions());
  const deleteMutation = useMutation(
    trpc.anniversary.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const sorted = useMemo(() => {
    if (!listQuery.data) return [];
    const today = todayIn(myTz, now);
    return [...listQuery.data]
      .map((a) => {
        const occurrence = nextOccurrence(dateOnly(a.date), a.recurring, today);
        return { ...a, occurrence, days: daysBetween(today, occurrence) };
      })
      .filter((a) => a.days >= 0)
      .sort((a, b) => a.days - b.days);
  }, [listQuery.data, myTz, now]);

  return (
    <Section
      title="기념일"
      addTitle="기념일 추가"
      defaultAddOpen={openAdd}
      renderAdd={(close) => (
        <AnniversaryForm onDone={close} onCreated={() => listQuery.refetch()} />
      )}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : sorted.length === 0 ? (
        <EmptyRow>처음 만난 날, 생일 같은 날을 적어두세요</EmptyRow>
      ) : (
        sorted.map((a) => (
          <Row
            key={a.id}
            icon={
              a.recurring ? (
                <Gift className="text-dusk-ink size-5" />
              ) : (
                <Heart className="text-ember size-5" />
              )
            }
            title={a.title}
            sub={`${formatYMD(a.occurrence)}${a.recurring ? " · 매년" : ""}`}
            end={
              <>
                <span className="text-dusk-ink text-sm font-semibold">{formatDday(a.days)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${a.title} 삭제`}
                  className="text-muted-foreground"
                  onClick={() => deleteMutation.mutate({ id: a.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            }
          />
        ))
      )}
    </Section>
  );
}

function AnniversaryForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [recurring, setRecurring] = useState(true);
  const createMutation = useMutation(
    trpc.anniversary.create.mutationOptions({
      onSuccess: () => {
        onCreated();
        onDone();
      },
    }),
  );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        createMutation.mutate({ title: title.trim(), date, recurring });
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 생일" />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="text-foreground flex items-center gap-2 text-sm">
        <Checkbox checked={recurring} onCheckedChange={(checked) => setRecurring(!!checked)} />
        매년 반복
      </label>
      <Button type="submit" size="lg" disabled={!title.trim() || createMutation.isPending}>
        추가
      </Button>
    </form>
  );
}
