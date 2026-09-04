"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDeliverAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalInputValue(d);
}

// 예약 메시지(PRD.md §3.4). deliverAt 전에는 발신자 본인만 내용을 볼 수
// 있고, 수신자에게는 목록에서 잠긴 상태로만 보인다.
export function CapsuleNotes({ currentUserId }: { currentUserId: string }) {
  const trpc = useTRPC();
  const [content, setContent] = useState("");
  const [deliverAt, setDeliverAt] = useState(defaultDeliverAt);

  const listQuery = useQuery(trpc.capsule.list.queryOptions());
  const createMutation = useMutation(
    trpc.capsule.create.mutationOptions({
      onSuccess: () => {
        setContent("");
        listQuery.refetch();
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const deleteMutation = useMutation(
    trpc.capsule.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  function handleCreate() {
    if (!content.trim()) return;
    createMutation.mutate({
      content: content.trim(),
      deliverAt: new Date(deliverAt).toISOString(),
    });
  }

  return (
    <div className="border-border border-b px-6 py-3">
      <p className="text-foreground mb-2 text-xs font-medium">캡슐 노트</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="미래의 너에게"
          className="max-w-56"
        />
        <Input
          type="datetime-local"
          value={deliverAt}
          onChange={(e) => setDeliverAt(e.target.value)}
          className="max-w-48"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!content.trim() || createMutation.isPending}
        >
          <Mail /> 예약 보내기
        </Button>
      </div>

      {listQuery.data && listQuery.data.length > 0 && (
        <ul className="flex flex-col gap-1">
          {listQuery.data.map((capsule) => {
            const mine = capsule.senderId === currentUserId;
            const locked = capsule.content === null;
            return (
              <li key={capsule.id} className="text-muted-foreground text-xs">
                <div className="flex items-center justify-between">
                  <span>
                    {mine ? "나 → 상대방" : "상대방 → 나"} ·{" "}
                    {new Date(capsule.deliverAt).toLocaleString("ko-KR")}
                    {locked && " (아직 도착 전)"}
                  </span>
                  {mine && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="캡슐 삭제"
                      onClick={() => deleteMutation.mutate({ id: capsule.id })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                {!locked && (
                  <p className="text-foreground font-handwritten mt-0.5 text-base">
                    {capsule.content}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
