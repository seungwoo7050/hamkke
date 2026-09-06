import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { questionByKey, questionForDateKey, utcDateKey } from "@/lib/daily-question";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

export const questionRouter = router({
  // 오늘의 질문 + 내 답. 상대 답은 내가 먼저 답한 뒤에만 공개한다(PRD §3.2) —
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
      question: questionForDateKey(dateKey),
      myAnswer: mine?.content ?? null,
      partnerAnswered: partners !== null,
      partnerAnswer: mine ? (partners?.content ?? null) : null,
    };
  }),

  // 한 번 답하면 고치지 않는다 — 상대가 이미 내 답을 봤을 수 있어서다.
  answer: spaceProcedure
    .input(z.object({ content: z.string().trim().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const dateKey = utcDateKey(new Date());
      try {
        return await prisma.dailyAnswer.create({
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
          throw new TRPCError({ code: "CONFLICT", message: "오늘 질문에는 이미 답했어요." });
        }
        throw error;
      }
    }),

  // "기억 › 지나온"용 — 내가 답한 날만, 최신순. 내가 답한 날이므로 상대 답도
  // 공개 조건을 만족한다.
  history: spaceProcedure.query(async ({ ctx }) => {
    const mine = await prisma.dailyAnswer.findMany({
      where: { spaceId: ctx.space.id, userId: ctx.session.user.id },
      orderBy: { dateKey: "desc" },
      take: 60,
    });
    const partners = await prisma.dailyAnswer.findMany({
      where: {
        spaceId: ctx.space.id,
        userId: { not: ctx.session.user.id },
        dateKey: { in: mine.map((a) => a.dateKey) },
      },
    });
    const partnerByDate = new Map(partners.map((a) => [a.dateKey, a.content]));

    return mine.map((a) => ({
      dateKey: a.dateKey,
      question: questionByKey(a.questionKey) ?? null,
      myAnswer: a.content,
      partnerAnswer: partnerByDate.get(a.dateKey) ?? null,
    }));
  }),
});
