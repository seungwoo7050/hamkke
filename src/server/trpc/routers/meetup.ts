import { z } from "zod";
import { FREE_TIER_LIMITS, isPremiumSpace } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

// 같은 날짜끼리도 순서가 정해져야 "최근 N곳"이 매번 같다.
const PIN_ORDER = [{ date: "desc" as const }, { id: "desc" as const }];

export const meetupRouter = router({
  // 무료 티어는 "위치 히스토리(만남 지도) 무제한 보관"이 프리미엄 혜택이라 최근
  // N곳까지만 보여 준다. 지우지 않고 숨길 뿐이라 업그레이드하면 다시 다 보인다 -
  // 예전엔 한도를 넘으면 오래된 핀을 지워서, 해지한 뒤 핀 하나가 지난 기록 여럿을
  // 되돌릴 수 없이 지웠다.
  list: spaceProcedure.query(async ({ ctx }) => {
    const premium = await isPremiumSpace(ctx.space.id);
    const [pins, total] = await Promise.all([
      prisma.meetupPin.findMany({
        where: { spaceId: ctx.space.id },
        orderBy: PIN_ORDER,
        ...(premium ? {} : { take: FREE_TIER_LIMITS.meetupPins }),
      }),
      prisma.meetupPin.count({ where: { spaceId: ctx.space.id } }),
    ]);
    return { pins, hidden: total - pins.length };
  }),

  // 한도를 넘어도 막거나 지우지 않는다. 다만 지난 만남을 소급 기록하면 그 핀이
  // 보이는 최근 N곳 밖일 수 있어, 화면이 알려 줄 수 있게 보이는지를 함께 돌려준다.
  create: spaceProcedure
    .input(
      z.object({
        label: z.string().min(1).max(50),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        date: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pin = await prisma.meetupPin.create({ data: { spaceId: ctx.space.id, ...input } });

      let visible = true;
      if (!(await isPremiumSpace(ctx.space.id))) {
        const shown = await prisma.meetupPin.findMany({
          where: { spaceId: ctx.space.id },
          orderBy: PIN_ORDER,
          take: FREE_TIER_LIMITS.meetupPins,
          select: { id: true },
        });
        visible = shown.some((p) => p.id === pin.id);
      }

      return { ...pin, visible };
    }),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.meetupPin.deleteMany({ where: { id: input.id, spaceId: ctx.space.id } });
    return { ok: true };
  }),
});
