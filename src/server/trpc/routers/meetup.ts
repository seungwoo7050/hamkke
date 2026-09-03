import { z } from "zod";
import { FREE_TIER_LIMITS, isPremiumSpace } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

export const meetupRouter = router({
  list: spaceProcedure.query(({ ctx }) =>
    prisma.meetupPin.findMany({ where: { spaceId: ctx.space.id }, orderBy: { date: "desc" } }),
  ),

  // 무료 티어는 "위치 히스토리(만남 지도) 무제한 보관"이 프리미엄 혜택이라
  // 최근 N개까지만 유지한다 — 생성을 막는 대신, 한도를 넘으면 가장 오래된
  // (date 기준) 핀을 자동으로 정리한다.
  create: spaceProcedure
    .input(
      z.object({
        label: z.string().min(1).max(50),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        date: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pin = await prisma.meetupPin.create({ data: { spaceId: ctx.space.id, ...input } });

      if (!(await isPremiumSpace(ctx.space.id))) {
        const excess = await prisma.meetupPin.findMany({
          where: { spaceId: ctx.space.id },
          orderBy: { date: "desc" },
          skip: FREE_TIER_LIMITS.meetupPins,
          select: { id: true },
        });
        if (excess.length > 0) {
          await prisma.meetupPin.deleteMany({ where: { id: { in: excess.map((p) => p.id) } } });
        }
      }

      return pin;
    }),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.meetupPin.deleteMany({ where: { id: input.id, spaceId: ctx.space.id } });
    return { ok: true };
  }),
});
