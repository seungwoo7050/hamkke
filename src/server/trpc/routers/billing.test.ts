// 실제 Stripe API(테스트 모드)에 왕복한다.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createCallerFactory } from "../init";
import { appRouter } from "./_app";

const createCaller = createCallerFactory(appRouter);

async function callerFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createCaller({
    session: {
      user: { id: user.id, spaceId: user.spaceId, name: null, email: user.email, image: null },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    baseUrl: "http://localhost:3000",
  });
}

describe("billing 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;
  const createdCustomerIds: string[] = [];

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-billing-a-${randomUUID()}@example.com` },
    });
    userAId = a.id;

    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    spaceId = space.id;
    await prisma.user.update({ where: { id: userAId }, data: { spaceId } });
  });

  afterEach(async () => {
    await Promise.all(createdCustomerIds.map((id) => stripe.customers.del(id)));
    createdCustomerIds.length = 0;
    await prisma.subscription.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("구독 전이면 status는 null이고, 실제 Stripe Checkout Session URL을 발급받는다", async () => {
    const caller = await callerFor(userAId);

    expect(await caller.billing.status()).toBeNull();

    const { url } = await caller.billing.createCheckoutSession();
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    // 방금 만든 Customer를 정리하기 위해 Checkout Session에서 역추적한다.
    const sessionId = new URL(url).pathname.split("/").pop()!.split("#")[0];
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    createdCustomerIds.push(session.customer as string);
  });

  it("이미 활성 구독이 있으면 새 Checkout Session을 만들 수 없다", async () => {
    await prisma.subscription.create({
      data: {
        spaceId,
        stripeCustomerId: `cus_fake_${randomUUID()}`,
        stripeSubscriptionId: `sub_fake_${randomUUID()}`,
        plan: "premium",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const caller = await callerFor(userAId);
    await expect(caller.billing.createCheckoutSession()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-billing-b-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(caller.billing.createCheckoutSession()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
