import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { FREE_TIER_LIMITS, isPremiumSpace } from "@/lib/plan";
import { router, spaceProcedure } from "../init";

const createInput = z
  .object({
    content: z.string().min(1).max(2000),
    deliverAt: z.coerce.date(),
  })
  .refine((data) => data.deliverAt > new Date(), {
    message: "배달 시각은 미래여야 해요",
    path: ["deliverAt"],
  });

export const capsuleRouter = router({
  // 발신자는 항상 내용을 볼 수 있고, 수신자는 deliverAt이 지나야 볼 수
  // 있다. 정확한 시각 push 스케줄러가 없어(Phase 4 각주), 이 조회 자체가
  // "배달"을 겸한다 — deliverAt이 지났는데 아직 deliveredAt이 없는 걸
  // 수신자가 조회하면 그 순간 deliveredAt을 채운다.
  list: spaceProcedure.query(async ({ ctx }) => {
    const rows = await prisma.capsule.findMany({
      where: { spaceId: ctx.space.id },
      orderBy: { deliverAt: "asc" },
    });

    const now = new Date();
    const toMarkDelivered = rows
      .filter((r) => r.senderId !== ctx.session.user.id && r.deliverAt <= now && !r.deliveredAt)
      .map((r) => r.id);

    if (toMarkDelivered.length > 0) {
      await prisma.capsule.updateMany({
        where: { id: { in: toMarkDelivered } },
        data: { deliveredAt: now },
      });
    }

    return rows.map((r) => {
      const unlocked = r.senderId === ctx.session.user.id || r.deliverAt <= now;
      return {
        ...r,
        content: unlocked ? r.content : null,
        deliveredAt: toMarkDelivered.includes(r.id) ? now : r.deliveredAt,
      };
    });
  }),

  // 무료 티어는 아직 안 열린(예약 중인) 캡슐 개수를 제한한다(PRD.md §3.5
  // "캡슐 노트 무제한 예약"이 프리미엄 혜택). 이미 배달된 것은 과거 기록이라
  // 세지 않는다.
  create: spaceProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    if (!(await isPremiumSpace(ctx.space.id))) {
      const pendingCount = await prisma.capsule.count({
        where: { spaceId: ctx.space.id, deliveredAt: null },
      });
      if (pendingCount >= FREE_TIER_LIMITS.activeCapsules) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `무료 티어는 예약 중인 캡슐을 ${FREE_TIER_LIMITS.activeCapsules}개까지만 가질 수 있어요. 프리미엄으로 무제한 예약해보세요.`,
        });
      }
    }

    return prisma.capsule.create({
      data: { spaceId: ctx.space.id, senderId: ctx.session.user.id, ...input },
    });
  }),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.capsule.deleteMany({
      where: { id: input.id, spaceId: ctx.space.id, senderId: ctx.session.user.id },
    });
    return { ok: true };
  }),
});
