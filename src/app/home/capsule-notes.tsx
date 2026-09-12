"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Lock, Mail, MailOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { josa } from "@/lib/josa";
import { formatDateTime } from "@/lib/datetime";
import { SPRING } from "@/lib/motion";
import { markCapsuleUnsealed, useUnsealedCapsules } from "@/lib/unsealed-capsules";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, Row, Section } from "./memories/section";
import { UpgradeHint } from "./upgrade-hint";
import { displayName, useMyTimeZone, useSpace } from "./space-context";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 내일 같은 시각, 분은 시각 선택(10분 단위)에 맞춰 내림.
function defaultDeliverAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(Math.floor(d.getMinutes() / 10) * 10, 0, 0);
  return toLocalInputValue(d);
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
  const myTz = useMyTimeZone();
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
      {listQuery.isPending ? (
        <LoadingRow />
      ) : waiting.length === 0 ? (
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
              sub={`${formatDateTime(new Date(capsule.deliverAt), myTz, { weekday: false })}에 열려요`}
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
  const myTz = useMyTimeZone();
  const { currentUserId, summary } = useSpace();
  const partnerName = displayName(summary.partner, "상대");
  const listQuery = useCapsules();
  const unsealed = useUnsealedCapsules();

  const now = useNow();
  const opened = (listQuery.data ?? [])
    .filter((c) => new Date(c.deliverAt) <= now && c.content !== null)
    .reverse();

  if (opened.length === 0) return null;

  return (
    <Section title="열린 캡슐">
      <div className="flex flex-col gap-3">
        {opened.map((capsule) => {
          const mine = capsule.senderId === currentUserId;
          const when = formatDateTime(new Date(capsule.deliverAt), myTz, { weekday: false });
          return (
            <CapsuleLetter
              key={capsule.id}
              sealed={!mine && !unsealed.has(capsule.id)}
              onOpen={() => markCapsuleUnsealed(capsule.id)}
              from={mine ? `${partnerName}에게` : `${partnerName}로부터`}
              when={when}
              sealedTitle={`${partnerName}의 편지`}
              content={capsule.content ?? ""}
            />
          );
        })}
      </div>
    </Section>
  );
}

// 캡슐이 열리는 순간(DESIGN.md §3.4 "열림" 상태 변화, §2 감정적 순간).
// 받은 편지는 처음엔 봉인된 채로 도착해 있고, 직접 눌러야 펼쳐진다 — 목록을
// 여는 것만으로 내용이 한꺼번에 쏟아지지 않게. 봉인이 걷히면 손글씨가 위에서
// 아래로 펼쳐지듯 드러난다(spring 프리셋 하나). 내가 보낸 편지는 처음부터 펼침.
function CapsuleLetter({
  sealed,
  onOpen,
  from,
  when,
  sealedTitle,
  content,
}: {
  sealed: boolean;
  onOpen: () => void;
  from: string;
  when: string;
  sealedTitle: string;
  content: string;
}) {
  const reduce = useReducedMotion();
  // 이 화면에서 직접 연 경우에만 펼침 모션 — 이미 열어둔 편지는 그대로 보인다.
  const [justOpened, setJustOpened] = useState(false);

  return (
    <motion.article layout={!reduce} transition={SPRING} className="bg-muted rounded-lg">
      <AnimatePresence initial={false} mode="popLayout">
        {sealed ? (
          <motion.button
            key="sealed"
            type="button"
            onClick={() => {
              setJustOpened(true);
              onOpen();
            }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="bg-background text-dusk-ink grid size-10 shrink-0 place-items-center rounded-full">
              <Mail className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-foreground font-semibold">{sealedTitle}</span>
              <span className="text-muted-foreground text-sm">{when}에 도착했어요</span>
            </span>
            <span className="text-primary text-sm font-semibold">열어보기</span>
          </motion.button>
        ) : (
          <motion.div
            key="open"
            initial={reduce || !justOpened ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-3"
          >
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <MailOpen className="size-4" />
              {from} · {when}
            </p>
            {/* DESIGN.md §3.2: 캡슐 노트는 손글씨 폰트가 허용되는 감정적 순간 */}
            <motion.p
              initial={reduce || !justOpened ? false : { clipPath: "inset(0 0 100% 0)", y: -4 }}
              animate={{ clipPath: "inset(0 0 0% 0)", y: 0 }}
              transition={{ ...SPRING, delay: 0.08 }}
              className="text-foreground font-handwritten mt-1 text-lg leading-snug break-words whitespace-pre-wrap"
            >
              {content}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
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
      <UpgradeHint usageKey="activeCapsules" />
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="미래의 너에게"
      />
      <DateTimeField label="열리는 날" value={deliverAt} onChange={setDeliverAt} />
      <Button type="submit" size="lg" disabled={!content.trim() || createMutation.isPending}>
        예약 보내기
      </Button>
    </form>
  );
}
