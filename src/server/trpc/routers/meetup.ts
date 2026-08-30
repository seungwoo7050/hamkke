import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

export const meetupRouter = router({
  list: spaceProcedure.query(({ ctx }) =>
    prisma.meetupPin.findMany({ where: { spaceId: ctx.space.id }, orderBy: { date: "desc" } }),
  ),

  create: spaceProcedure
    .input(
      z.object({
        label: z.string().min(1).max(50),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        date: z.coerce.date(),
      }),
    )
    .mutation(({ ctx, input }) =>
      prisma.meetupPin.create({ data: { spaceId: ctx.space.id, ...input } }),
    ),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.meetupPin.deleteMany({ where: { id: input.id, spaceId: ctx.space.id } });
    return { ok: true };
  }),
});
