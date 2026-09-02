import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

const LOOKBACK_DAYS = 60;

export const streakRouter = router({
  // 연속 계산은 로컬 타임존 기준이어야 해서(src/lib/streak.ts) 클라이언트에서
  // 한다 — 여기서는 최근 원시 활동 날짜만 돌려준다.
  activeDates: spaceProcedure.query(async ({ ctx }) => {
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);

    const rows = await prisma.message.findMany({
      where: { spaceId: ctx.space.id, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    return rows.map((r) => r.createdAt);
  }),
});
