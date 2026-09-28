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
        // 화면은 "현재 위치로 등록"으로만 만든다 - 만든 사람은 이미 그 안에 있다.
        // false로 두면 다음 위치에서 곧바로 "도착" 알림이 간다.
        data: { spaceId: ctx.space.id, userId: ctx.session.user.id, ...input, isInside: true },
      }),
    ),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.geofence.deleteMany({ where: { id: input.id, userId: ctx.session.user.id } });
    return { ok: true };
  }),
});
