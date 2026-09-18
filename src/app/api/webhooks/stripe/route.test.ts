// stripe.webhooks.generateTestHeaderString으로 실제 서명 검증 로직까지
// 그대로 태운다(constructEvent가 진짜로 통과해야 한다).
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { POST } from "./route";

function subscriptionEvent(
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `evt_test_${randomUUID()}`,
    object: "event",
    type,
    data: {
      object: {
        id: `sub_test_${randomUUID()}`,
        object: "subscription",
        customer: `cus_test_${randomUUID()}`,
        status: "active",
        metadata: {},
        items: { object: "list", data: [{ current_period_end: 1893456000 }] },
        ...overrides,
      },
    },
  };
}

async function postSignedEvent(event: unknown) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  const request = new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": header },
  });
  return POST(request);
}

describe("POST /api/webhooks/stripe", () => {
  let spaceId: string;

  beforeEach(async () => {
    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    spaceId = space.id;
  });

  afterEach(async () => {
    await prisma.subscription.deleteMany({ where: { spaceId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("잘못된 서명은 400으로 거부한다", async () => {
    const request = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "customer.subscription.created" }),
      headers: { "stripe-signature": "t=1,v1=invalid" },
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("subscription.created가 오면 Subscription을 새로 만든다", async () => {
    const subscriptionId = `sub_test_${randomUUID()}`;
    const event = subscriptionEvent("customer.subscription.created", {
      id: subscriptionId,
      metadata: { spaceId },
    });

    const res = await postSignedEvent(event);
    expect(res.status).toBe(200);

    const stored = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    expect(stored?.spaceId).toBe(spaceId);
    expect(stored?.status).toBe("active");
  });

  it("spaceId metadata가 없으면 조용히 무시한다", async () => {
    const event = subscriptionEvent("customer.subscription.created");
    const res = await postSignedEvent(event);
    expect(res.status).toBe(200);
    // 예외 없이 200을 돌려주는 것 자체가 검증 대상 — 별도로 조회할 spaceId가 없다.
  });

  it("subscription.updated가 오면 기존 Subscription의 status가 갱신된다", async () => {
    const subscriptionId = `sub_test_${randomUUID()}`;
    await postSignedEvent(
      subscriptionEvent("customer.subscription.created", {
        id: subscriptionId,
        metadata: { spaceId },
      }),
    );

    await postSignedEvent(
      subscriptionEvent("customer.subscription.updated", {
        id: subscriptionId,
        metadata: { spaceId },
        status: "past_due",
      }),
    );

    const stored = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    expect(stored?.status).toBe("past_due");
  });

  it("subscription.deleted가 오면 status가 canceled로 바뀐다", async () => {
    const subscriptionId = `sub_test_${randomUUID()}`;
    await postSignedEvent(
      subscriptionEvent("customer.subscription.created", {
        id: subscriptionId,
        metadata: { spaceId },
      }),
    );

    await postSignedEvent(
      subscriptionEvent("customer.subscription.deleted", {
        id: subscriptionId,
        metadata: { spaceId },
        status: "canceled",
      }),
    );

    const stored = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    expect(stored?.status).toBe("canceled");
  });

  it("해지 후 재구독하면(새 구독 ID) 같은 스페이스의 Subscription이 새 구독으로 바뀐다", async () => {
    const customerId = `cus_test_${randomUUID()}`;
    const oldId = `sub_test_${randomUUID()}`;
    const newId = `sub_test_${randomUUID()}`;
    await postSignedEvent(
      subscriptionEvent("customer.subscription.created", {
        id: oldId,
        customer: customerId,
        metadata: { spaceId },
      }),
    );
    await postSignedEvent(
      subscriptionEvent("customer.subscription.deleted", {
        id: oldId,
        customer: customerId,
        metadata: { spaceId },
        status: "canceled",
      }),
    );

    const res = await postSignedEvent(
      subscriptionEvent("customer.subscription.created", {
        id: newId,
        customer: customerId,
        metadata: { spaceId },
      }),
    );
    expect(res.status).toBe(200);

    const stored = await prisma.subscription.findUnique({ where: { spaceId } });
    expect(stored?.stripeSubscriptionId).toBe(newId);
    expect(stored?.status).toBe("active");
  });

  it("지난 구독의 늦게 도착한 이벤트는 새 활성 구독을 덮어쓰지 않는다", async () => {
    const customerId = `cus_test_${randomUUID()}`;
    const oldId = `sub_test_${randomUUID()}`;
    const newId = `sub_test_${randomUUID()}`;
    await postSignedEvent(
      subscriptionEvent("customer.subscription.created", {
        id: newId,
        customer: customerId,
        metadata: { spaceId },
      }),
    );

    const res = await postSignedEvent(
      subscriptionEvent("customer.subscription.deleted", {
        id: oldId,
        customer: customerId,
        metadata: { spaceId },
        status: "canceled",
      }),
    );
    expect(res.status).toBe(200);

    const stored = await prisma.subscription.findUnique({ where: { spaceId } });
    expect(stored?.stripeSubscriptionId).toBe(newId);
    expect(stored?.status).toBe("active");
  });
});
