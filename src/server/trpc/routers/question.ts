import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  questionByKey,
  questionForDateKey,
  utcDateKey,
  type DailyQuestion,
} from "@/lib/daily-question";
import { Prisma } from "@/generated/prisma/client";
import { josa } from "@/lib/josa";
import { prisma } from "@/lib/prisma";
import { sendPushToSpacePartner } from "@/lib/push";
import { broadcastToSpace } from "@/lib/supabase/broadcast";
import { router, spaceProcedure } from "../init";
import { translator } from "@/i18n/server";

// 질문 문장은 요청자의 언어로 붙여 보낸다(두 사람이 각자의 언어로 같은 질문을 본다).
function withText(question: DailyQuestion, locale?: string) {
  return { key: question.key, text: translator(locale)(`questions.${question.key}`) };
}

export const questionRouter = router({
  // 오늘의 질문 + 내 답. 상대 답은 내가 먼저 답한 뒤에만 공개한다(PRD §3.2) -
  // 먼저 보고 맞춰 쓰는 걸 막아야 답이 솔직해진다. 답하기 전에는 "상대가
  // 답했는지" 여부만 알려준다.
  today: spaceProcedure.query(async ({ ctx }) => {
    const dateKey = utcDateKey(new Date());
    const answers = await prisma.dailyAnswer.findMany({
      where: { spaceId: ctx.space.id, dateKey },
    });
    const mine = answers.find((a) => a.userId === ctx.session.user.id) ?? null;
    const partners = answers.find((a) => a.userId !== ctx.session.user.id) ?? null;

    return {
      dateKey,
      question: withText(questionForDateKey(dateKey), ctx.locale),
      myAnswer: mine?.content ?? null,
      partnerAnswered: partners !== null,
      partnerAnswer: mine ? (partners?.content ?? null) : null,
    };
  }),

  // 한 번 답하면 고치지 않는다 - 상대가 이미 내 답을 봤을 수 있어서다.
  answer: spaceProcedure
    .input(z.object({ content: z.string().trim().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const dateKey = utcDateKey(new Date());
      let answer;
      try {
        answer = await prisma.dailyAnswer.create({
          data: {
            spaceId: ctx.space.id,
            userId: ctx.session.user.id,
            dateKey,
            questionKey: questionForDateKey(dateKey).key,
            content: input.content,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: translator(ctx.locale)("errors.questionAnswered"),
          });
        }
        throw error;
      }

      // 상대 화면의 "오늘의 질문" 카드가 바로 "답했어요"로 바뀌게 알린다(내용은
      // 싣지 않는다 - 상대 답은 상대가 먼저 답해야 열린다, PRD §3.2).
      await broadcastToSpace(ctx.space.id, "question-answered", {
        userId: ctx.session.user.id,
        dateKey,
      });

      // 질문 답변 알림(PRD §3.6). 알림 실패가 답변 저장을 막으면 안 되므로 삼킨다.
      const me = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { name: true },
      });
      await sendPushToSpacePartner(ctx.space.id, ctx.session.user.id, (t) => {
        const name = me?.name?.trim() || t("push.partnerFallback");
        // 한국어 문구는 조사가 붙은 {nameSubj}, 다른 언어는 {name}을 쓴다.
        return {
          title: "Hamkke",
          body: t("push.questionAnswered", {
            name,
            nameSubj: josa(name, "이/가"),
          }),
        };
      }).catch(() => {});

      return answer;
    }),

  // "기억 › 지나온"용 - 내가 답한 날만, 최신순. 내가 답한 날이므로 상대 답도
  // 공개 조건을 만족한다. 커서는 마지막으로 받은 dateKey(그보다 이전 날부터).
  history: spaceProcedure
    .input(
      z
        .object({
          cursor: z.string().nullish(),
          limit: z.number().min(1).max(50).default(20),
        })
        .default({ limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      const mine = await prisma.dailyAnswer.findMany({
        where: {
          spaceId: ctx.space.id,
          userId: ctx.session.user.id,
          ...(input.cursor ? { dateKey: { lt: input.cursor } } : {}),
        },
        orderBy: { dateKey: "desc" },
        take: input.limit + 1,
      });
      const hasMore = mine.length > input.limit;
      const page = hasMore ? mine.slice(0, input.limit) : mine;

      const partners = await prisma.dailyAnswer.findMany({
        where: {
          spaceId: ctx.space.id,
          userId: { not: ctx.session.user.id },
          dateKey: { in: page.map((a) => a.dateKey) },
        },
      });
      const partnerByDate = new Map(partners.map((a) => [a.dateKey, a.content]));

      return {
        items: page.map((a) => ({
          dateKey: a.dateKey,
          question: (() => {
            const q = questionByKey(a.questionKey);
            return q ? withText(q, ctx.locale) : null;
          })(),
          myAnswer: a.content,
          partnerAnswer: partnerByDate.get(a.dateKey) ?? null,
        })),
        nextCursor: hasMore ? page[page.length - 1].dateKey : undefined,
      };
    }),
});
