import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

export const countdownRouter = router({
  list: spaceProcedure.query(({ ctx }) =>
    prisma.countdown.findMany({ where: { spaceId: ctx.space.id }, orderBy: { targetDate: "asc" } }),
  ),

  create: spaceProcedure
    .input(z.object({ title: z.string().min(1).max(100), targetDate: z.coerce.date() }))
    .mutation(({ ctx, input }) =>
      prisma.countdown.create({ data: { spaceId: ctx.space.id, ...input } }),
    ),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.countdown.deleteMany({ where: { id: input.id, spaceId: ctx.space.id } });
    return { ok: true };
  }),
});
