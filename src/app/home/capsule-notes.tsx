"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { josa } from "@/lib/josa";
import { useHydrated } from "@/lib/use-hydrated";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, Row, Section } from "./memories/section";
import { displayName, useSpace } from "./space-context";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDeliverAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalInputValue(d);
}

function formatDeliverAt(date: Date) {
  return date.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// 예약 메시지(PRD.md §3.4). deliverAt 전에는 발신자 본인만 내용을 볼 수
// 있고, 수신자에게는 잠긴 상태로만 보인다. 기억 탭에서 "다가올"(아직 안
// 열림)과 "지나온"(열림) 두 곳에 나눠 보여주므로 같은 목록 쿼리를 공유한다.
function useCapsules() {
  const trpc = useTRPC();
  return useQuery(trpc.capsule.list.queryOptions());
}

export function UpcomingCapsules() {
  const trpc = useTRPC();
  const hydrated = useHydrated();
  const { currentUserId, summary } = useSpace();
  const partnerName = displayName(summary.partner, "상대");
  const listQuery = useCapsules();
  const deleteMutation = useMutation(
    trpc.capsule.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const now = useNow();
  const waiting = (listQuery.data ?? []).filter((c) => new Date(c.deliverAt) > now);

  return (
    <Section
      title="도착 예정 캡슐"
      addTitle="캡슐 예약하기"
      renderAdd={(close) => <CapsuleForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {!hydrated ? null : waiting.length === 0 ? (
        <EmptyRow>
          정해둔 날에 열리는 편지를 {josa(partnerName, "이/가")} 받게 할 수 있어요
        </EmptyRow>
      ) : (
        waiting.map((capsule) => {
          const mine = capsule.senderId === currentUserId;
          return (
            <Row
              key={capsule.id}
              icon={<Lock className="text-dusk-ink size-5" />}
              title={mine ? `${partnerName}에게 보낸 편지` : `${partnerName}의 편지`}
              sub={`${formatDeliverAt(new Date(capsule.deliverAt))}에 열려요`}
              end={
                mine && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="캡슐 삭제"
                    className="text-muted-foreground"
                    onClick={() => deleteMutation.mutate({ id: capsule.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )
              }
            />
          );
        })
      )}
    </Section>
  );
}

export function OpenedCapsules() {
  const hydrated = useHydrated();
  const { currentUserId, summary } = useSpace();
  const partnerName = displayName(summary.partner, "상대");
  const listQuery = useCapsules();

  const now = useNow();
  const opened = (listQuery.data ?? [])
    .filter((c) => new Date(c.deliverAt) <= now && c.content !== null)
    .reverse();

  if (!hydrated || opened.length === 0) return null;

  return (
    <Section title="열린 캡슐">
      <div className="flex flex-col gap-3">
        {opened.map((capsule) => (
          <article key={capsule.id} className="bg-muted rounded-lg px-4 py-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Mail className="size-4" />
              {capsule.senderId === currentUserId
                ? `${partnerName}에게`
                : `${partnerName}로부터`} · {formatDeliverAt(new Date(capsule.deliverAt))}
            </p>
            {/* DESIGN.md §3.2: 캡슐 노트는 손글씨 폰트가 허용되는 감정적 순간 */}
            <p className="text-foreground font-handwritten mt-1 text-lg leading-snug">
              {capsule.content}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}

function CapsuleForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const trpc = useTRPC();
  const [content, setContent] = useState("");
  const [deliverAt, setDeliverAt] = useState(defaultDeliverAt);
  const createMutation = useMutation(
    trpc.capsule.create.mutationOptions({
      onSuccess: () => {
        onCreated();
        onDone();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!content.trim()) return;
        createMutation.mutate({
          content: content.trim(),
          deliverAt: new Date(deliverAt).toISOString(),
        });
      }}
    >
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="미래의 너에게"
      />
      <label className="text-muted-foreground flex flex-col gap-1 text-sm">
        열리는 시각
        <Input
          type="datetime-local"
          value={deliverAt}
          onChange={(e) => setDeliverAt(e.target.value)}
        />
      </label>
      <Button type="submit" size="lg" disabled={!content.trim() || createMutation.isPending}>
        예약 보내기
      </Button>
    </form>
  );
}
