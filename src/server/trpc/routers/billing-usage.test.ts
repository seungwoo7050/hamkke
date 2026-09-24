// billing.test.ts는 실제 Stripe에 왕복하므로, Stripe와 무관한 사용량 조회는
// 따로 둔다.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FREE_TIER_LIMITS } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { createCallerFactory } from "../init";
import { appRouter } from "./_app";

const createCaller = createCallerFactory(appRouter);

async function callerFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createCaller({
    session: {
      user: { id: user.id, spaceId: user.spaceId, name: null, email: null, image: null },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    baseUrl: "http://localhost:3000",
  });
}

describe("billing.usage (통합)", () => {
  let userId: string;
  let spaceId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `test-usage-${randomUUID()}@example.com` },
    });
    userId = user.id;
    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    spaceId = space.id;
    await prisma.user.update({ where: { id: userId }, data: { spaceId } });
  });

  afterEach(async () => {
    await prisma.subscription.deleteMany({ where: { spaceId } });
    await prisma.moment.deleteMany({ where: { spaceId } });
    await prisma.capsule.deleteMany({ where: { spaceId } });
    await prisma.meetupPin.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("게이팅과 같은 방식으로 센다 — 캡슐은 아직 안 열린 것만", async () => {
    await prisma.moment.createMany({
      data: [1, 2].map((i) => ({ spaceId, uploaderId: userId, mediaUrl: `k${i}` })),
    });
    await prisma.capsule.createMany({
      data: [
        {
          spaceId,
          senderId: userId,
          content: "예약",
          deliverAt: new Date(Date.now() + 86_400_000),
        },
        {
          spaceId,
          senderId: userId,
          content: "열림",
          deliverAt: new Date(Date.now() - 86_400_000),
          deliveredAt: new Date(),
        },
        {
          // 열리는 때는 지났지만 상대가 아직 안 열었다 — 예약 중이 아니다.
          spaceId,
          senderId: userId,
          content: "열렸지만 안 읽음",
          deliverAt: new Date(Date.now() - 60_000),
        },
      ],
    });
    await prisma.meetupPin.create({
      data: { spaceId, label: "카페", lat: 37.5, lng: 127, date: new Date() },
    });

    const usage = await (await callerFor(userId)).billing.usage();
    expect(usage.premium).toBe(false);
    expect(usage.items).toEqual([
      { key: "moments", label: "사진", used: 2, limit: FREE_TIER_LIMITS.moments },
      {
        key: "activeCapsules",
        label: "예약 캡슐",
        used: 1,
        limit: FREE_TIER_LIMITS.activeCapsules,
      },
      { key: "meetupPins", label: "만남 지도", used: 1, limit: FREE_TIER_LIMITS.meetupPins },
    ]);
  });

  it("프리미엄이면 한도 항목이 없다", async () => {
    await prisma.subscription.create({
      data: {
        spaceId,
        stripeCustomerId: `cus_${randomUUID()}`,
        stripeSubscriptionId: `sub_${randomUUID()}`,
        plan: "premium",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    expect(await (await callerFor(userId)).billing.usage()).toEqual({ premium: true, items: [] });
  });
});
