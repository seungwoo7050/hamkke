"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Hourglass, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysUntil } from "@/lib/anniversary";
import { useTRPC } from "@/trpc/client";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDday(days: number) {
  if (days === 0) return "오늘";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

// PRD.md §3.4 "다음 만남까지 카운트다운" — 가장 가까운 목표일을 위에 크게
// 강조하고, 나머지는 기념일 트래커와 같은 리스트 UI로 통일한다.
export function CountdownTracker() {
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState(todayInputValue);

  const listQuery = useQuery(trpc.countdown.list.queryOptions());
  const createMutation = useMutation(
    trpc.countdown.create.mutationOptions({
      onSuccess: () => {
        setTitle("");
        listQuery.refetch();
      },
    }),
  );
  const deleteMutation = useMutation(
    trpc.countdown.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const sorted = useMemo(() => {
    if (!listQuery.data) return [];
    const now = new Date();
    return listQuery.data
      .map((c) => ({ ...c, days: daysUntil(new Date(c.targetDate), now) }))
      .sort((a, b) => a.days - b.days);
  }, [listQuery.data]);

  function handleCreate() {
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim(), targetDate });
  }

  return (
    <div className="border-border border-b px-6 py-3">
      <p className="text-foreground mb-2 text-xs font-medium">다음 만남 카운트다운</p>
      {sorted[0] && (
        <p className="text-primary mb-2 text-lg font-semibold">
          {formatDday(sorted[0].days)} · {sorted[0].title}
        </p>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 다음 만남"
          className="max-w-40"
        />
        <Input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="max-w-36"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!title.trim() || createMutation.isPending}
        >
          <Hourglass /> 추가
        </Button>
      </div>

      {sorted.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sorted.map((c) => (
            <li
              key={c.id}
              className="text-muted-foreground flex items-center justify-between text-xs"
            >
              <span>
                {formatDday(c.days)} · {c.title}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`${c.title} 삭제`}
                onClick={() => deleteMutation.mutate({ id: c.id })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
