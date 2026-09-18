import { TRPCError } from "@trpc/server";
import { FREE_TIER_LIMITS, isPremiumSpace } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { router, spaceProcedure } from "../init";
import { translator } from "@/i18n/server";

export const billingRouter = router({
  // 구독 주체는 Space(ARCHITECTURE.md §6) — 한쪽이 결제하면 둘 다 프리미엄.
  status: spaceProcedure.query(({ ctx }) =>
    prisma.subscription.findUnique({ where: { spaceId: ctx.space.id } }),
  ),

  // 무료 한도 대비 현재 사용량(PRD §3.5 "요금제 사용량 표시"). 세는 방식은 각
  // 기능의 게이팅과 같다 — 사진은 전체 수, 캡슐은 아직 안 열린(예약 중) 수,
  // 만남 지도는 전체 핀 수(한도를 넘으면 오래된 것부터 정리됨). 프리미엄이면
  // 한도가 없으므로 items는 비운다.
  usage: spaceProcedure.query(async ({ ctx }) => {
    if (await isPremiumSpace(ctx.space.id)) return { premium: true as const, items: [] };

    const spaceId = ctx.space.id;
    const [moments, activeCapsules, meetupPins] = await Promise.all([
      prisma.moment.count({ where: { spaceId } }),
      prisma.capsule.count({ where: { spaceId, deliveredAt: null } }),
      prisma.meetupPin.count({ where: { spaceId } }),
    ]);

    return {
      premium: false as const,
      items: [
        { key: "moments" as const, label: "사진", used: moments, limit: FREE_TIER_LIMITS.moments },
        {
          key: "activeCapsules" as const,
          label: "예약 캡슐",
          used: activeCapsules,
          limit: FREE_TIER_LIMITS.activeCapsules,
        },
        {
          key: "meetupPins" as const,
          label: "만남 지도",
          used: meetupPins,
          limit: FREE_TIER_LIMITS.meetupPins,
        },
      ],
    };
  }),

  createCheckoutSession: spaceProcedure.mutation(async ({ ctx }) => {
    const existing = await prisma.subscription.findUnique({ where: { spaceId: ctx.space.id } });
    if (existing?.status === "active") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: translator(ctx.locale)("errors.alreadySubscribed"),
      });
    }

    // 과거에 만든 적 있는 Customer가 있으면 재사용(취소 후 재구독 시나리오).
    const customerId =
      existing?.stripeCustomerId ??
      (
        await stripe.customers.create({
          email: ctx.session.user.email ?? undefined,
          metadata: { spaceId: ctx.space.id },
        })
      ).id;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID!, quantity: 1 }],
      success_url: `${ctx.baseUrl}/home?checkout=success`,
      cancel_url: `${ctx.baseUrl}/home?checkout=cancel`,
      subscription_data: { metadata: { spaceId: ctx.space.id } },
      metadata: { spaceId: ctx.space.id },
    });

    return { url: session.url! };
  }),

  // 해지/결제수단 변경은 자체 UI로 구현하지 않고 Stripe Customer Portal로
  // 위임한다(ARCHITECTURE.md §6).
  createPortalSession: spaceProcedure.mutation(async ({ ctx }) => {
    const subscription = await prisma.subscription.findUnique({
      where: { spaceId: ctx.space.id },
    });
    if (!subscription) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: translator(ctx.locale)("errors.noSubscription"),
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${ctx.baseUrl}/home`,
    });

    return { url: session.url };
  }),
});
