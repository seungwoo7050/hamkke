"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Gift, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysUntil, nextOccurrence } from "@/lib/anniversary";
import { useTRPC } from "@/trpc/client";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDday(days: number) {
  if (days === 0) return "오늘";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

// 정확한 시각 push 스케줄러가 아직 없어(docs/COMMIT_PLAN.md Phase 4 각주)
// "다가오는 기념일"은 매 렌더링마다 클라이언트의 로컬 오늘 기준으로 다시
// 계산한다(src/lib/anniversary.ts).
export function AnniversaryTracker() {
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [recurring, setRecurring] = useState(true);

  const listQuery = useQuery(trpc.anniversary.list.queryOptions());
  const createMutation = useMutation(
    trpc.anniversary.create.mutationOptions({
      onSuccess: () => {
        setTitle("");
        listQuery.refetch();
      },
    }),
  );
  const deleteMutation = useMutation(
    trpc.anniversary.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const sorted = useMemo(() => {
    if (!listQuery.data) return [];
    const now = new Date();
    return [...listQuery.data]
      .map((a) => {
        const occurrence = nextOccurrence(new Date(a.date), a.recurring, now);
        return { ...a, days: daysUntil(occurrence, now) };
      })
      .sort((a, b) => a.days - b.days);
  }, [listQuery.data]);

  function handleCreate() {
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim(), date, recurring });
  }

  return (
    <div className="border-border border-b px-6 py-3">
      <p className="text-foreground mb-2 text-xs font-medium">기념일</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 생일"
          className="max-w-40"
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="max-w-36"
        />
        <label className="text-muted-foreground flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          매년 반복
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!title.trim() || createMutation.isPending}
        >
          <Gift /> 추가
        </Button>
      </div>

      {sorted.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sorted.map((a) => (
            <li
              key={a.id}
              className="text-muted-foreground flex items-center justify-between text-xs"
            >
              <span>
                {formatDday(a.days)} · {a.title}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`${a.title} 삭제`}
                onClick={() => deleteMutation.mutate({ id: a.id })}
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
