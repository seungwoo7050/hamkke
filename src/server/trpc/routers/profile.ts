import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { protectedProcedure, router, spaceProcedure } from "../init";

export const profileRouter = router({
  // 브라우저가 감지한 IANA 타임존으로 동기화한다(시차 위젯용). 사용자가
  // 여행 등으로 위치를 옮기면 다음 로그인 때 자동으로 갱신된다.
  setTimezone: protectedProcedure
    .input(z.object({ timezone: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { timezone: input.timezone },
      });
      return { timezone: input.timezone };
    }),

  timezones: spaceProcedure.query(async ({ ctx }) => {
    const [me, partner] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { timezone: true },
      }),
      prisma.user.findFirst({
        where: { spaceId: ctx.space.id, id: { not: ctx.session.user.id } },
        select: { timezone: true },
      }),
    ]);
    return { me: me.timezone, partner: partner?.timezone ?? null };
  }),
});
