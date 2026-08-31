"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

// datetime-local input은 "YYYY-MM-DDTHH:mm"를 로컬 시간 기준으로 받는다
// (toISOString()은 UTC라 그대로 쓰면 시간대만큼 어긋난다).
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInputValue(d);
}

function defaultEnd() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return toLocalInputValue(d);
}

function formatRange(startAt: Date | string, endAt: Date | string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", weekday: "short" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const sameDay = start.toDateString() === end.toDateString();
  const startStr = `${start.toLocaleDateString("ko-KR", dateFmt)} ${start.toLocaleTimeString("ko-KR", timeFmt)}`;
  const endStr = sameDay
    ? end.toLocaleTimeString("ko-KR", timeFmt)
    : `${end.toLocaleDateString("ko-KR", dateFmt)} ${end.toLocaleTimeString("ko-KR", timeFmt)}`;
  return `${startStr} ~ ${endStr}`;
}

// 달력 그리드 대신 다가오는 순 리스트로 단순화했다(PRD.md §3.4 범위,
// 과한 엔지니어링 방지 — docs/COMMIT_PLAN.md Phase 4 각주 참고).
export function CalendarView() {
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);

  const listQuery = useQuery(trpc.calendar.list.queryOptions());
  const createMutation = useMutation(
    trpc.calendar.create.mutationOptions({
      onSuccess: () => {
        setTitle("");
        listQuery.refetch();
      },
      onError: () => toast.error("일정 저장에 실패했어요(종료 시각을 확인해주세요)"),
    }),
  );
  const deleteMutation = useMutation(
    trpc.calendar.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  function handleCreate() {
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  return (
    <div className="border-border border-b px-6 py-3">
      <p className="text-foreground mb-2 text-xs font-medium">공유 캘린더</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 영상통화"
          className="max-w-40"
        />
        <Input
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          className="max-w-48"
        />
        <Input
          type="datetime-local"
          value={endAt}
          onChange={(e) => setEndAt(e.target.value)}
          className="max-w-48"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!title.trim() || createMutation.isPending}
        >
          <CalendarPlus /> 추가
        </Button>
      </div>

      {listQuery.data && listQuery.data.length > 0 && (
        <ul className="flex flex-col gap-1">
          {listQuery.data.map((event) => (
            <li
              key={event.id}
              className="text-muted-foreground flex items-center justify-between text-xs"
            >
              <span>
                {formatRange(event.startAt, event.endAt)} · {event.title}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`${event.title} 삭제`}
                onClick={() => deleteMutation.mutate({ id: event.id })}
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
