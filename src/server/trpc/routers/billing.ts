import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  countPendingCapsules,
  FREE_TIER_LIMITS,
  isPremiumOpen,
  isPremiumSpace,
  STORAGE_LIMIT_BYTES,
} from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { consumeOrThrow } from "@/server/rate-limit";
import { billingSessionCheck } from "@/server/request-limits";
import { storageUsedBytes } from "@/server/storage-quota";
import { router, spaceProcedure } from "../init";
import { translator } from "@/i18n/server";

export const billingRouter = router({
  // 구독 주체는 Space(ARCHITECTURE.md §6) - 한쪽이 결제하면 둘 다 프리미엄.
  status: spaceProcedure.query(({ ctx }) =>
    prisma.subscription.findUnique({ where: { spaceId: ctx.space.id } }),
  ),

  // 무료 한도 대비 현재 사용량(PRD §3.5 "요금제 사용량 표시"). 세는 방식은 각
  // 기능의 게이팅과 같다 - 사진은 전체 수, 캡슐은 열리는 때가 아직 안 온(예약 중) 수,
  // 만남 지도는 전체 핀 수(한도를 넘으면 오래된 것부터 정리됨). 프리미엄이면
  // 한도가 없으므로 items는 비운다. 저장 공간은 프리미엄에도 상한(20GB)이 있어
  // 두 요금제 모두 보여 준다 - 한도에 부딪히기 전에 알 수 있게.
  usage: spaceProcedure.query(async ({ ctx }) => {
    const spaceId = ctx.space.id;
    const [premium, storageUsed] = await Promise.all([
      isPremiumSpace(spaceId),
      storageUsedBytes(spaceId),
    ]);
    const storage = {
      used: storageUsed,
      limit: premium ? STORAGE_LIMIT_BYTES.premium : STORAGE_LIMIT_BYTES.free,
    };
    const open = isPremiumOpen();
    if (premium) return { premium: true as const, open, items: [], storage };

    const [moments, activeCapsules, meetupPins] = await Promise.all([
      prisma.moment.count({ where: { spaceId } }),
      countPendingCapsules(spaceId),
      prisma.meetupPin.count({ where: { spaceId } }),
    ]);

    return {
      premium: false as const,
      open,
      storage,
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

  // 이중 구독 방지: 두 사람이 동시에 누르거나 결제 화면을 여러 번 열어도
  // 스페이스당 Customer 하나, 열린 Checkout 세션 하나만 쓴다 - 같은 세션은 한
  // 번만 결제할 수 있다. 스페이스 단위 잠금으로 확인과 생성을 직렬화한다.
  //
  // Play 앱(한국 대체 결제)은 결제 전에 받은 거래 토큰을 같이 보낸다(src/lib/alternative-
  // billing.ts). 토큰은 세션과 구독의 metadata(playToken)에 실어 두고, 결제가 끝나면 그
  // 구독의 청구서를 Play 개발자 API에 보고할 때 쓴다(src/server/play-reporting.ts).
  createCheckoutSession: spaceProcedure
    .input(
      z.object({ externalTransactionToken: z.string().min(1).max(4096).optional() }).optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const playToken = input?.externalTransactionToken;
      // 유료 플랜이 닫혀 있으면 화면에 버튼이 없어도 API로 결제를 시작할 수 없게.
      if (!isPremiumOpen()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: translator(ctx.locale)("errors.premiumNotOpen"),
        });
      }
      await consumeOrThrow(billingSessionCheck(ctx.session.user.id), ctx.locale);
      const spaceId = ctx.space.id;
      return prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${spaceId}`}))`;

          const [space, existing] = await Promise.all([
            tx.space.findUniqueOrThrow({ where: { id: spaceId } }),
            tx.subscription.findUnique({ where: { spaceId } }),
          ]);
          if (existing?.status === "active") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: translator(ctx.locale)("errors.alreadySubscribed"),
            });
          }

          // 과거에 만든 Customer가 있으면 재사용(취소 후 재구독 시나리오 포함).
          let customerId = space.stripeCustomerId ?? existing?.stripeCustomerId;
          if (!customerId) {
            customerId = (
              await stripe.customers.create({
                email: ctx.session.user.email ?? undefined,
                metadata: { spaceId },
              })
            ).id;
          }
          if (space.stripeCustomerId !== customerId) {
            await tx.space.update({
              where: { id: spaceId },
              data: { stripeCustomerId: customerId },
            });
          }

          // 열린 세션은 같은 거래(토큰이 같거나 둘 다 웹)일 때만 다시 쓴다. 다른 거래의
          // 세션은 만료시켜 스페이스당 열린 세션이 하나뿐이게 한다(이중 결제 방지).
          const open = await stripe.checkout.sessions.list({
            customer: customerId,
            status: "open",
          });
          const mine = open.data.filter(
            (s) => s.mode === "subscription" && s.metadata?.spaceId === spaceId && s.url,
          );
          const reusable = mine.find((s) => (s.metadata?.playToken ?? undefined) === playToken);
          if (reusable) return { url: reusable.url! };
          for (const stale of mine) await stripe.checkout.sessions.expire(stale.id);

          const metadata: Record<string, string> = playToken ? { spaceId, playToken } : { spaceId };

          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID!, quantity: 1 }],
            success_url: `${ctx.baseUrl}/home?checkout=success`,
            cancel_url: `${ctx.baseUrl}/home?checkout=cancel`,
            subscription_data: { metadata },
            metadata,
          });

          return { url: session.url! };
        },
        // 잠금을 쥔 채 Stripe를 두세 번 부르므로 기본 5초보다 넉넉하게.
        { timeout: 20_000, maxWait: 20_000 },
      );
    }),

  // 해지/결제수단 변경은 자체 UI로 구현하지 않고 Stripe Customer Portal로
  // 위임한다(ARCHITECTURE.md §6).
  createPortalSession: spaceProcedure.mutation(async ({ ctx }) => {
    await consumeOrThrow(billingSessionCheck(ctx.session.user.id), ctx.locale);
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
