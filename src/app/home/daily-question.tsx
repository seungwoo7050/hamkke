"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { useFormat } from "@/i18n/use-format";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, LoadMore, Section } from "./memories/section";
import { useSpaceBroadcast } from "./realtime-context";
import { usePartnerName, useSpace } from "./space-context";

export function useTodayQuestion() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { currentUserId } = useSpace();
  // 상대가 답하면 카드 문구("답했어요")와 열린 시트의 상대 답이 바로 바뀌게.
  useSpaceBroadcast<{ userId: string }>("question-answered", ({ userId }) => {
    if (userId === currentUserId) return;
    void queryClient.invalidateQueries(trpc.question.today.pathFilter());
    void queryClient.invalidateQueries(trpc.question.history.pathFilter());
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
  const t = useTranslations("question");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const partnerName = usePartnerName();
  const names = fmt.particles(partnerName);
  const today = useTodayQuestion();
  const [draft, setDraft] = useState("");

  const answerMutation = useMutation(
    trpc.question.answer.mutationOptions({
      onSuccess: () => {
        setDraft("");
        void queryClient.invalidateQueries(trpc.question.today.pathFilter());
        void queryClient.invalidateQueries(trpc.question.history.pathFilter());
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
              <DrawerDescription>{t("today")}</DrawerDescription>
              <DrawerTitle className="leading-snug">{data.question.text}</DrawerTitle>
            </DrawerHeader>
            {data.myAnswer ? (
              <div className="bg-muted flex flex-col gap-2 rounded-lg px-4 py-3">
                <Answer who={tc("me")}>{data.myAnswer}</Answer>
                <Answer who={partnerName}>
                  {data.partnerAnswer ?? t("partnerWillShow", names)}
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
                    data.partnerAnswered ? t("partnerAnswered", names) : t("placeholder")
                  }
                />
                <p className="text-muted-foreground text-xs">{t("noEdit")}</p>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!draft.trim() || answerMutation.isPending}
                >
                  {t("submit")}
                </Button>
              </form>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// dateKey는 UTC 날짜(PRD §3.2)라 로컬 변환 없이 그대로 읽는다.
function dateKeyToYMD(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return { y, m, d };
}

// 기억 › 지나온 — 내가 답한 날만(그래야 상대 답도 열려 있다).
export function QuestionHistory() {
  const trpc = useTRPC();
  const t = useTranslations("question");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const partnerName = usePartnerName();
  const history = useInfiniteQuery(
    trpc.question.history.infiniteQueryOptions(
      { limit: 20 },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Section title={t("history")}>
      {history.isPending ? (
        <LoadingRow />
      ) : items.length === 0 ? (
        <EmptyRow>{t("historyEmpty")}</EmptyRow>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <article key={item.dateKey} className="bg-muted rounded-lg px-4 py-3">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <MessageCircleQuestion className="size-4" />
                {fmt.ymd(dateKeyToYMD(item.dateKey))}
              </p>
              <p className="text-foreground mt-1 mb-2 text-sm font-semibold">
                {item.question?.text ?? t("missing")}
              </p>
              <div className="flex flex-col gap-1">
                <Answer who={tc("me")}>{item.myAnswer}</Answer>
                <Answer who={partnerName}>{item.partnerAnswer ?? t("notYet")}</Answer>
              </div>
            </article>
          ))}
          <LoadMore
            hasMore={history.hasNextPage}
            loading={history.isFetchingNextPage}
            onLoad={() => void history.fetchNextPage()}
          />
        </div>
      )}
    </Section>
  );
}
