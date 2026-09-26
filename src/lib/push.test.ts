// 푸시 문구의 언어(PRD §3.8): 받는 사람이 고른 언어 → 그 사람의 기기 언어 → 한국어.
// FCM 전송만 가짜로 바꾸고 DB는 실제 Postgres를 쓴다.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendPushToSpacePartner } from "./push";

const sent = vi.hoisted(() => [] as { title: string; body: string }[]);
vi.mock("@/lib/firebase-admin", () => ({
  getAdminMessaging: () => ({
    send: async (m: { notification: { title: string; body: string } }) => {
      sent.push(m.notification);
      return "message-id";
    },
  }),
}));

describe("sendPushToSpacePartner 언어", () => {
  let spaceId: string;
  let senderId: string;
  let partnerId: string;

  beforeEach(async () => {
    sent.length = 0;
    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    spaceId = space.id;
    const [sender, partner] = await Promise.all([
      prisma.user.create({ data: { email: `push-a-${randomUUID()}@example.com`, spaceId } }),
      prisma.user.create({ data: { email: `push-b-${randomUUID()}@example.com`, spaceId } }),
    ]);
    senderId = sender.id;
    partnerId = partner.id;
    await prisma.pushToken.create({ data: { userId: partnerId, token: `t-${randomUUID()}` } });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [senderId, partnerId] } } });
    await prisma.space.deleteMany({ where: { id: spaceId } });
  });

  const touch = () =>
    sendPushToSpacePartner(spaceId, senderId, (t) => ({ title: "Hamkke", body: t("push.touch") }));

  it("언어를 고르지 않았으면 기기 언어로 보낸다", async () => {
    await prisma.user.update({
      where: { id: partnerId },
      data: { locale: null, deviceLocale: "en" },
    });
    await touch();
    expect(sent.map((n) => n.body)).toEqual(["Your person is thinking of you"]);
  });

  it("고른 언어가 기기 언어보다 먼저다", async () => {
    await prisma.user.update({
      where: { id: partnerId },
      data: { locale: "ko", deviceLocale: "en" },
    });
    await touch();
    expect(sent.map((n) => n.body)).toEqual(["상대방이 생각하고 있어요"]);
  });

  it("둘 다 모르면 한국어", async () => {
    await touch();
    expect(sent.map((n) => n.body)).toEqual(["상대방이 생각하고 있어요"]);
  });
});
