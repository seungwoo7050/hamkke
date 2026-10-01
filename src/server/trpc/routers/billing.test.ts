// 실제 Stripe API(테스트 모드)에 왕복한다.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    // 결제 흐름 테스트는 유료 플랜을 파는 상태가 기준이다(닫힌 상태는 따로 본다).
    vi.stubEnv("PREMIUM_OPEN", "1");
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
    vi.unstubAllEnvs();
    await prisma.rateLimitHit.deleteMany({ where: { subject: userAId } });
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

  it("두 사람이 동시에 결제를 시작해도 같은 Customer의 같은 Checkout 세션을 받는다", async () => {
    const b = await prisma.user.create({
      data: { email: `test-billing-b-${randomUUID()}@example.com`, spaceId },
    });
    try {
      const [callerA, callerB] = await Promise.all([callerFor(userAId), callerFor(b.id)]);
      const [first, second] = await Promise.all([
        callerA.billing.createCheckoutSession(),
        callerB.billing.createCheckoutSession(),
      ]);

      const space = await prisma.space.findUniqueOrThrow({ where: { id: spaceId } });
      if (space.stripeCustomerId) createdCustomerIds.push(space.stripeCustomerId);

      expect(second.url).toBe(first.url);
      const sessionId = new URL(first.url).pathname.split("/").pop()!.split("#")[0];
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      expect(session.customer).toBe(space.stripeCustomerId);
    } finally {
      await prisma.user.delete({ where: { id: b.id } });
    }
  });

  it("결제 화면을 다시 열면 아직 열려 있는 세션을 재사용한다", async () => {
    const caller = await callerFor(userAId);
    const first = await caller.billing.createCheckoutSession();
    const space = await prisma.space.findUniqueOrThrow({ where: { id: spaceId } });
    createdCustomerIds.push(space.stripeCustomerId!);

    const again = await caller.billing.createCheckoutSession();
    expect(again.url).toBe(first.url);
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

  it("구독 내역이 없으면 Portal 세션을 만들 수 없다", async () => {
    const caller = await callerFor(userAId);
    await expect(caller.billing.createPortalSession()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("구독 중이면 실제 Stripe Customer Portal Session URL을 발급받는다", async () => {
    const customer = await stripe.customers.create({ metadata: { spaceId } });
    createdCustomerIds.push(customer.id);

    await prisma.subscription.create({
      data: {
        spaceId,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: `sub_fake_${randomUUID()}`,
        plan: "premium",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const caller = await callerFor(userAId);
    const { url } = await caller.billing.createPortalSession();
    expect(url).toMatch(/^https:\/\/billing\.stripe\.com\//);
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

  it("유료 플랜이 닫혀 있으면 결제를 시작할 수 없고, Stripe에 아무것도 만들지 않는다", async () => {
    vi.stubEnv("PREMIUM_OPEN", "");
    const caller = await callerFor(userAId);
    await expect(caller.billing.createCheckoutSession()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const space = await prisma.space.findUniqueOrThrow({ where: { id: spaceId } });
    expect(space.stripeCustomerId).toBeNull();
    // 열려 있다고 알려 주는 값도 닫힘을 가리킨다(화면은 이 값으로 버튼을 숨긴다).
    expect((await caller.billing.usage()).open).toBe(false);
  });

  it("결제·구독 관리 화면은 합쳐서 1시간에 10번까지만 연다", async () => {
    await prisma.rateLimitHit.createMany({
      data: Array.from({ length: 10 }, () => ({ bucket: "billing.session", subject: userAId })),
    });
    const caller = await callerFor(userAId);
    await expect(caller.billing.createCheckoutSession()).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    await expect(caller.billing.createPortalSession()).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});
