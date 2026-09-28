import { z } from "zod";
import { todayIn } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { computeStreak } from "@/lib/streak";
import { isValidTimeZone } from "@/lib/timezone";
import { router, spaceProcedure } from "../init";

// 메시지를 보는 사람의 시간대에서 날짜로 묶는다. createdAt은 UTC 벽시계 값을
// 시간대 없이 저장하므로 먼저 UTC로 읽고 그 시간대로 옮긴다. 날짜 단위로만
// 돌려줘서 메시지가 많아도 응답은 대화한 날 수만큼이다.
async function activeDays(spaceId: string, timeZone: string) {
  const rows = await prisma.$queryRaw<{ day: string }[]>`
    SELECT DISTINCT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day
    FROM "Message"
    WHERE "spaceId" = ${spaceId}
  `;
  return rows.map((r) => r.day);
}

export const streakRouter = router({
  // 하루 경계는 보는 사람의 시간대 - 브라우저가 알려 준다(서버 UTC로 자르면
  // 한국은 오전 9시에 날이 바뀐다). 기간 상한 없이 처음부터 센다.
  current: spaceProcedure
    .input(z.object({ timeZone: z.string().max(100).refine(isValidTimeZone) }))
    .query(async ({ ctx, input }) => {
      let timeZone = input.timeZone;
      let days: string[];
      try {
        days = await activeDays(ctx.space.id, timeZone);
      } catch {
        // Intl은 알지만 Postgres의 시간대 데이터에 없는 이름이면 UTC로 센다.
        timeZone = "UTC";
        days = await activeDays(ctx.space.id, timeZone);
      }
      return computeStreak(days, todayIn(timeZone, new Date()));
    }),
});
