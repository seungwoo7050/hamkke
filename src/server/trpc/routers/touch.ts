import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPushToSpacePartner } from "@/lib/push";
import { broadcastToSpace } from "@/lib/supabase/broadcast";
import { router, spaceProcedure } from "../init";

export const touchRouter = router({
  send: spaceProcedure.mutation(async ({ ctx }) => {
    const touch = await prisma.touch.create({
      data: { spaceId: ctx.space.id, senderId: ctx.session.user.id },
    });

    await broadcastToSpace(ctx.space.id, "touch", touch);

    // 상대가 탭을 닫아뒀거나 백그라운드에 있어도 받을 수 있도록 푸시도 시도한다.
    // 푸시 발송 실패가 터치 자체의 성공을 막으면 안 되므로 에러는 삼킨다.
    await sendPushToSpacePartner(ctx.space.id, ctx.session.user.id, (t) => ({
      title: "Hamkke",
      body: t("push.touch"),
    })).catch(() => {});

    return touch;
  }),

  // 상대가 나에게 마지막으로 보낸 터치. "우리" 장면과 Android 홈 위젯의
  // "3시간 전에 생각해줬어요" 표시용(PRD §3.2) — 내가 보낸 터치는 제외한다.
  latest: spaceProcedure.query(({ ctx }) =>
    prisma.touch.findFirst({
      where: { spaceId: ctx.space.id, senderId: { not: ctx.session.user.id } },
      orderBy: { createdAt: "desc" },
    }),
  ),

  // 대화 흐름 안에 "생각하고 있어요"를 끼워 넣기 위한 조회(승인 목업 ②).
  // 채팅이 불러온 가장 오래된 메시지 시각을 since로 넘기면 그 구간의
  // 터치만 온다 — 채팅 페이지네이션과 같은 범위를 맞춘다.
  list: spaceProcedure.input(z.object({ since: z.coerce.date() })).query(({ ctx, input }) =>
    prisma.touch.findMany({
      where: { spaceId: ctx.space.id, createdAt: { gte: input.since } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ),
});
