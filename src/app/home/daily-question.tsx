"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { josa } from "@/lib/josa";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, Section } from "./memories/section";
import { useSpaceBroadcast } from "./realtime-context";
import { displayName, useSpace } from "./space-context";

export function useTodayQuestion() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { currentUserId } = useSpace();
  // 상대가 답하면 카드 문구("답했어요")와 열린 시트의 상대 답이 바로 바뀌게.
  useSpaceBroadcast<{ userId: string }>("question-answered", ({ userId }) => {
    if (userId === currentUserId) return;
    void queryClient.invalidateQueries(trpc.question.today.queryFilter());
    void queryClient.invalidateQueries(trpc.question.history.queryFilter());
  });
  return useQuery(trpc.question.today.queryOptions());
}

function Answer({ who, children }: { who: string; children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      <span className="text-foreground mr-1.5 font-semibold">{who}</span>
      {children}
    </p>
  );
}

// 하루 한 질문(PRD §3.2, 신규 기능 N6). 상대 답은 내가 먼저 답해야 열린다 —
// 서버(question.today)가 그 전엔 내용을 아예 보내지 않는다. 답하는 순간 여는
// 카드(상황 카드)는 사라지지만 시트는 열린 채로 상대 답을 보여줘야 하므로,
// 트리거와 분리된 제어형 시트로 둔다.
export function QuestionSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { summary } = useSpace();
  const partnerName = displayName(summary.partner, "상대");
  const today = useTodayQuestion();
  const [draft, setDraft] = useState("");

  const answerMutation = useMutation(
    trpc.question.answer.mutationOptions({
      onSuccess: () => {
        setDraft("");
        void queryClient.invalidateQueries(trpc.question.today.queryFilter());
        void queryClient.invalidateQueries(trpc.question.history.queryFilter());
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const data = today.data;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {data && (
          <div className="flex flex-col gap-4">
            <DrawerHeader>
              <DrawerDescription>오늘의 질문</DrawerDescription>
              <DrawerTitle className="leading-snug">{data.question.text}</DrawerTitle>
            </DrawerHeader>
            {data.myAnswer ? (
              <div className="bg-muted flex flex-col gap-2 rounded-lg px-4 py-3">
                <Answer who="나">{data.myAnswer}</Answer>
                <Answer who={partnerName}>
                  {data.partnerAnswer ?? `${josa(partnerName, "이/가")} 답하면 여기 보여요`}
                </Answer>
              </div>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  answerMutation.mutate({ content: draft.trim() });
                }}
              >
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={1000}
                  placeholder={
                    data.partnerAnswered
                      ? `${josa(partnerName, "은/는")} 답했어요. 내가 답하면 볼 수 있어요`
                      : "생각나는 대로 적어보세요"
                  }
                />
                <p className="text-muted-foreground text-xs">한 번 보내면 고칠 수 없어요</p>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!draft.trim() || answerMutation.isPending}
                >
                  답하기
                </Button>
              </form>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function formatDateKey(dateKey: string) {
  // dateKey는 UTC 날짜(PRD §3.2)라 로컬 변환 없이 그대로 읽는다.
  const [, m, d] = dateKey.split("-").map(Number);
  return `${m}월 ${d}일`;
}

// 기억 › 지나온 — 내가 답한 날만(그래야 상대 답도 열려 있다).
export function QuestionHistory() {
  const trpc = useTRPC();
  const { summary } = useSpace();
  const partnerName = displayName(summary.partner, "상대");
  const history = useQuery(trpc.question.history.queryOptions());
  const items = history.data ?? [];

  return (
    <Section title="지난 질문">
      {items.length === 0 ? (
        <EmptyRow>오늘의 질문에 답하면 여기에 둘의 답이 쌓여요</EmptyRow>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <article key={item.dateKey} className="bg-muted rounded-lg px-4 py-3">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <MessageCircleQuestion className="size-4" />
                {formatDateKey(item.dateKey)}
              </p>
              <p className="text-foreground mt-1 mb-2 text-sm font-semibold">
                {item.question?.text ?? "사라진 질문"}
              </p>
              <div className="flex flex-col gap-1">
                <Answer who="나">{item.myAnswer}</Answer>
                <Answer who={partnerName}>{item.partnerAnswer ?? "아직 답하지 않았어요"}</Answer>
              </div>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}
