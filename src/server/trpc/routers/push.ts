import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { protectedProcedure, router } from "../init";

export const pushRouter = router({
  // 로그인만 되어 있으면(아직 페어링 전이라도) 등록 가능 - 알림 권한 요청은
  // 온보딩 단계에서도 뜰 수 있다.
  registerToken: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.pushToken.upsert({
        where: { token: input.token },
        create: { token: input.token, userId: ctx.session.user.id },
        update: { userId: ctx.session.user.id },
      });
      return { ok: true };
    }),
});
