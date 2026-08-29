import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

export const geofenceRouter = router({
  list: spaceProcedure.query(({ ctx }) =>
    prisma.geofence.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "asc" },
    }),
  ),

  create: spaceProcedure
    .input(
      z.object({
        label: z.string().min(1).max(50),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusM: z.number().int().min(50).max(5000).default(200),
      }),
    )
    .mutation(({ ctx, input }) =>
      prisma.geofence.create({
        data: { spaceId: ctx.space.id, userId: ctx.session.user.id, ...input },
      }),
    ),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.geofence.deleteMany({ where: { id: input.id, userId: ctx.session.user.id } });
    return { ok: true };
  }),
});
