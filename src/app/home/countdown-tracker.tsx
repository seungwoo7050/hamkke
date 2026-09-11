"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Hourglass, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateOnly, daysBetween, formatYMD, todayIn } from "@/lib/datetime";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, Row, Section } from "./memories/section";
import { useMyTimeZone } from "./space-context";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDday(days: number) {
  if (days === 0) return "오늘";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

// PRD.md §3.4 "다음 만남까지 카운트다운" — 가장 가까운 목표일 하나를 크게
// (DESIGN.md §2 M3 Expressive 크기 대비), 나머지는 작은 줄로.
export function CountdownTracker({ openAdd = false }: { openAdd?: boolean }) {
  const trpc = useTRPC();
  const myTz = useMyTimeZone();
  const now = useNow();
  const listQuery = useQuery(trpc.countdown.list.queryOptions());
  const deleteMutation = useMutation(
    trpc.countdown.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const upcoming = useMemo(() => {
    if (!listQuery.data) return [];
    const today = todayIn(myTz, now);
    return listQuery.data
      .map((c) => {
        const target = dateOnly(c.targetDate);
        return { ...c, target, days: daysBetween(today, target) };
      })
      .filter((c) => c.days >= 0)
      .sort((a, b) => a.days - b.days);
  }, [listQuery.data, myTz, now]);

  const [next, ...rest] = upcoming;

  return (
    <Section
      title="다음 만남"
      addTitle="카운트다운 추가"
      defaultAddOpen={openAdd}
      renderAdd={(close) => <CountdownForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : next ? (
        <div className="bg-sky-dusk rounded-xl p-5">
          <p className="text-dusk-ink text-sm font-medium">{next.title}</p>
          <p className="text-foreground mt-1 text-5xl font-bold tracking-tight">
            {formatDday(next.days)}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {formatYMD(next.target, { weekday: true })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${next.title} 삭제`}
              className="text-muted-foreground"
              onClick={() => deleteMutation.mutate({ id: next.id })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <EmptyRow>다음에 만나는 날을 정해두면 여기서 세어줄게요</EmptyRow>
      )}
      {rest.map((c) => (
        <Row
          key={c.id}
          icon={<Hourglass className="text-dusk-ink size-5" />}
          title={c.title}
          end={
            <>
              <span className="text-dusk-ink text-sm font-semibold">{formatDday(c.days)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${c.title} 삭제`}
                className="text-muted-foreground"
                onClick={() => deleteMutation.mutate({ id: c.id })}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          }
        />
      ))}
    </Section>
  );
}

function CountdownForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const trpc = useTRPC();
  const [title, setTitle] = useState("다음 만남");
  const [targetDate, setTargetDate] = useState(todayInputValue);
  const createMutation = useMutation(
    trpc.countdown.create.mutationOptions({
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
        createMutation.mutate({ title: title.trim(), targetDate });
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 다음 만남" />
      <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      <Button type="submit" size="lg" disabled={!title.trim() || createMutation.isPending}>
        추가
      </Button>
    </form>
  );
}
