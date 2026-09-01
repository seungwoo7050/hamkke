import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

export const anniversaryRouter = router({
  // "다가오는 순" 정렬은 recurring 여부에 따라 매년 달라지는 D-day라
  // 클라이언트가 자신의 로컬 "오늘" 기준으로 계산한다(src/lib/anniversary.ts).
  list: spaceProcedure.query(({ ctx }) =>
    prisma.anniversary.findMany({ where: { spaceId: ctx.space.id }, orderBy: { date: "asc" } }),
  ),

  create: spaceProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        date: z.coerce.date(),
        recurring: z.boolean().default(true),
      }),
    )
    .mutation(({ ctx, input }) =>
      prisma.anniversary.create({ data: { spaceId: ctx.space.id, ...input } }),
    ),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.anniversary.deleteMany({ where: { id: input.id, spaceId: ctx.space.id } });
    return { ok: true };
  }),
});
