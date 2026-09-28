// 실제 로컬 DB + 실제 R2 + 실제 Stripe(테스트 모드)에 왕복한다.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { headUpload } from "@/lib/r2";
import { stripe } from "@/lib/stripe";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { deleteAccount } from "./account-deletion";

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

async function uploadMoment(userId: string) {
  const caller = await callerFor(userId);
  const { uploadUrl, key } = await caller.moment.createUploadUrl({
    contentType: "image/png",
    size: 1,
  });
  await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: new Uint8Array([1]),
  });
  const moment = await caller.moment.create({ key });
  return (await prisma.moment.findUniqueOrThrow({ where: { id: moment.id } })).mediaUrl;
}

describe("계정 삭제", { timeout: 60_000 }, () => {
  it("스페이스를 통째로 지운다 - 구독 해지, R2 파일, 대화·사진, 탈퇴자 계정. 상대는 스페이스 없이 남는다", async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `Del-A-${randomUUID()}@Example.com` } }),
      prisma.user.create({ data: { email: `del-b-${randomUUID()}@example.com` } }),
    ]);
    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await prisma.user.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { spaceId: space.id },
    });
    await prisma.session.create({
      data: {
        sessionToken: randomUUID(),
        userId: a.id,
        expires: new Date(Date.now() + 86_400_000),
      },
    });

    // 실제로 결제된 구독(테스트 카드)
    const customer = await stripe.customers.create({
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    try {
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID! }],
        metadata: { spaceId: space.id },
      });
      await prisma.subscription.create({
        data: {
          spaceId: space.id,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: sub.id,
          plan: "premium",
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        },
      });

      const photoKey = await uploadMoment(b.id); // 상대가 올린 사진도 함께 지워진다
      await (await callerFor(a.id)).chat.send({ content: "안녕" });
      // 등록하지 않은 임시 업로드
      const { uploadUrl, key: pendingKey } = await (
        await callerFor(a.id)
      ).chat.createImageUploadUrl({ contentType: "image/png", size: 1 });
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array([1]),
      });

      await deleteAccount(a.id);

      expect((await stripe.subscriptions.retrieve(sub.id)).status).toBe("canceled");
      expect(await headUpload(photoKey)).toBeNull();
      expect(await headUpload(pendingKey)).toBeNull();
      expect(await prisma.space.findUnique({ where: { id: space.id } })).toBeNull();
      expect(await prisma.message.count({ where: { spaceId: space.id } })).toBe(0);
      expect(await prisma.moment.count({ where: { spaceId: space.id } })).toBe(0);
      expect(await prisma.subscription.count({ where: { spaceId: space.id } })).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: a.id } })).toBeNull();
      expect(await prisma.session.count({ where: { userId: a.id } })).toBe(0);
      expect(await prisma.rateLimitHit.count({ where: { subject: a.id } })).toBe(0);

      const partner = await prisma.user.findUniqueOrThrow({ where: { id: b.id } });
      expect(partner.spaceId).toBeNull();
    } finally {
      await stripe.customers.del(customer.id);
      await prisma.rateLimitHit.deleteMany({ where: { subject: b.id } });
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    }
  });

  // 외래 키로 묶이지 않았거나 상대에게 묶인 것: 쓰지 않은 로그인 링크 토큰(이메일), 상대의
  // 위치 기록. 안내 페이지는 "두 사람 모두에게서 지워지고, 그 밖의 데이터는 남기지 않는다"고 한다.
  it("쓰지 않은 로그인 링크 토큰과 두 사람의 위치 기록을 지우고, 상대의 위치 공유를 끈다", async () => {
    const email = `Del-D-${randomUUID()}@Example.com`;
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email, locationSharingEnabled: true } }),
      prisma.user.create({
        data: { email: `del-e-${randomUUID()}@example.com`, locationSharingEnabled: true },
      }),
    ]);
    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await prisma.user.updateMany({
      where: { id: { in: [a.id, b.id] } },
      data: { spaceId: space.id },
    });
    await prisma.locationPing.createMany({
      data: [a.id, b.id].map((userId) => ({ userId, lat: 37.5, lng: 127 })),
    });
    // Auth.js는 소문자로 정규화한 이메일을 토큰의 identifier로 쓴다.
    await prisma.verificationToken.create({
      data: {
        identifier: email.toLowerCase(),
        token: randomUUID(),
        expires: new Date(Date.now() + 86_400_000),
      },
    });
    try {
      await deleteAccount(a.id);

      expect(
        await prisma.verificationToken.count({ where: { identifier: email.toLowerCase() } }),
      ).toBe(0);
      expect(await prisma.locationPing.count({ where: { userId: b.id } })).toBe(0);
      const partner = await prisma.user.findUniqueOrThrow({ where: { id: b.id } });
      expect(partner.locationSharingEnabled).toBe(false);
    } finally {
      await prisma.verificationToken.deleteMany({ where: { identifier: email.toLowerCase() } });
      await prisma.locationPing.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      await prisma.space.deleteMany({ where: { id: space.id } });
    }
  });

  it("페어링 전(초대코드만 만든) 계정도 지울 수 있다", async () => {
    const a = await prisma.user.create({ data: { email: `del-c-${randomUUID()}@example.com` } });
    await (await callerFor(a.id)).pairing.createInviteCode();
    const spaceId = (await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).spaceId!;

    await deleteAccount(a.id);

    expect(await prisma.user.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await prisma.space.findUnique({ where: { id: spaceId } })).toBeNull();
  });

  it("이미 없는 계정이면 조용히 끝난다(두 번 눌러도 안전)", async () => {
    await expect(deleteAccount(`missing-${randomUUID()}`)).resolves.toBeUndefined();
  });
});
