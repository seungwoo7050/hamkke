import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { router, spaceProcedure } from "../init";

export const billingRouter = router({
  // 구독 주체는 Space(ARCHITECTURE.md §6) — 한쪽이 결제하면 둘 다 프리미엄.
  status: spaceProcedure.query(({ ctx }) =>
    prisma.subscription.findUnique({ where: { spaceId: ctx.space.id } }),
  ),

  createCheckoutSession: spaceProcedure.mutation(async ({ ctx }) => {
    const existing = await prisma.subscription.findUnique({ where: { spaceId: ctx.space.id } });
    if (existing?.status === "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "이미 구독 중이에요." });
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
});
