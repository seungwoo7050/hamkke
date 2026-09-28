import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bestTimes } from "@/lib/flight";
import { countPendingCapsules, FREE_TIER_LIMITS, isPremiumSpace } from "@/lib/plan";
import { router, spaceProcedure } from "../init";
import { translator } from "@/i18n/server";

// 여는 때는 정한 시각(deliverAt) 또는 "상대가 탄 비행기가 착륙하면"(flightId,
// PRD §3.3.1) 둘 중 하나.
// (둘 중 하나·미래 시각 검사는 사람에게 보이는 문구라 요청자 언어로 본문에서 한다.)
const createInput = z.object({
  content: z.string().min(1).max(2000),
  deliverAt: z.coerce.date().optional(),
  flightId: z.string().optional(),
});

export const capsuleRouter = router({
  // 발신자는 항상 내용을 볼 수 있고, 수신자는 deliverAt이 지나야 볼 수
  // 있다. 정확한 시각 push 스케줄러가 없어(Phase 4 각주), 이 조회 자체가
  // "배달"을 겸한다 - deliverAt이 지났는데 아직 deliveredAt이 없는 걸
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

    // 같은 사람이 두 기기에서 동시에 열면 두 조회 모두 deliveredAt이 비어 있다고
    // 본다. 조건에 deliveredAt: null을 다시 넣어 먼저 쓴 쪽만 남기고, 응답에는 내가
    // 쓴 값이 아니라 실제로 저장된 값을 돌려준다.
    const openedAt = new Map<string, Date | null>();
    if (toMarkDelivered.length > 0) {
      await prisma.capsule.updateMany({
        where: { id: { in: toMarkDelivered }, deliveredAt: null },
        data: { deliveredAt: now },
      });
      const stored = await prisma.capsule.findMany({
        where: { id: { in: toMarkDelivered } },
        select: { id: true, deliveredAt: true },
      });
      for (const c of stored) openedAt.set(c.id, c.deliveredAt);
    }

    return rows.map((r) => {
      const unlocked = r.senderId === ctx.session.user.id || r.deliverAt <= now;
      return {
        ...r,
        content: unlocked ? r.content : null,
        deliveredAt: openedAt.get(r.id) ?? r.deliveredAt,
      };
    });
  }),

  // 무료 티어는 아직 안 열린(예약 중인) 캡슐 개수를 제한한다(PRD.md §3.5
  // "캡슐 노트 무제한 예약"이 프리미엄 혜택). 열리는 때가 지난 것은 상대가
  // 아직 안 열었어도 과거 기록이라 세지 않는다.
  create: spaceProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const t = translator(ctx.locale);
    if (!!input.deliverAt === !!input.flightId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: t("errors.capsuleOneWhen") });
    }
    if (input.deliverAt && input.deliverAt <= new Date()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: t("errors.capsuleFuture") });
    }
    if (!(await isPremiumSpace(ctx.space.id))) {
      const pendingCount = await countPendingCapsules(ctx.space.id);
      if (pendingCount >= FREE_TIER_LIMITS.activeCapsules) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: t("errors.capsuleLimit", { limit: FREE_TIER_LIMITS.activeCapsules }),
        });
      }
    }

    let deliverAt = input.deliverAt;
    if (input.flightId) {
      const flight = await prisma.flight.findFirst({
        where: { id: input.flightId, spaceId: ctx.space.id },
      });
      if (!flight) throw new TRPCError({ code: "NOT_FOUND", message: t("errors.flightNotFound") });
      // 착륙 편지는 타는 사람에게 남기는 것 - 내가 타는 비행기엔 걸 수 없다.
      if (flight.travelerId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: t("errors.capsulePartnerFlightOnly"),
        });
      }
      deliverAt = bestTimes(flight).arrivalAt;
      if (deliverAt <= new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: t("errors.flightLanded") });
      }
    }

    return prisma.capsule.create({
      data: {
        spaceId: ctx.space.id,
        senderId: ctx.session.user.id,
        content: input.content,
        deliverAt: deliverAt!,
        flightId: input.flightId ?? null,
      },
    });
  }),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.capsule.deleteMany({
      where: { id: input.id, spaceId: ctx.space.id, senderId: ctx.session.user.id },
    });
    return { ok: true };
  }),
});
