import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("meetup 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-meetup-a-${randomUUID()}@example.com` },
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
    await prisma.meetupPin.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("생성/조회가 날짜 내림차순으로 정상 동작한다", async () => {
    const caller = await callerFor(userAId);

    await caller.meetup.create({
      label: "첫 만남 카페",
      lat: 37.5,
      lng: 127.0,
      date: "2026-01-01",
    });
    await caller.meetup.create({
      label: "공항",
      lat: 37.4,
      lng: 126.5,
      date: "2026-06-01",
    });

    const { pins } = await caller.meetup.list();
    expect(pins).toHaveLength(2);
    expect(pins[0].label).toBe("공항");
    expect(pins[1].label).toBe("첫 만남 카페");
  });

  it("삭제하면 목록에서 사라진다", async () => {
    const caller = await callerFor(userAId);
    const pin = await caller.meetup.create({
      label: "바다",
      lat: 35.1,
      lng: 129.0,
      date: "2026-03-01",
    });

    await caller.meetup.delete({ id: pin.id });
    expect((await caller.meetup.list()).pins).toHaveLength(0);
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-meetup-b-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(
        caller.meetup.create({ label: "몰래", lat: 0, lng: 0, date: "2026-01-01" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  async function seedPins(count: number) {
    for (let i = 0; i < count; i++) {
      await prisma.meetupPin.create({
        data: { spaceId, label: `핀 ${i}`, lat: 0, lng: 0, date: new Date(2020, 0, i + 1) },
      });
    }
  }

  it("무료 티어는 최근 20곳만 보여 주되, 한도를 넘어도 지우지 않는다", async () => {
    const caller = await callerFor(userAId);
    await seedPins(20);

    const created = await caller.meetup.create({
      label: "새 핀",
      lat: 0,
      lng: 0,
      date: "2026-01-01",
    });
    expect(created.visible).toBe(true);

    const { pins, hidden } = await caller.meetup.list();
    expect(pins).toHaveLength(20);
    expect(hidden).toBe(1);
    expect(pins.some((p) => p.label === "핀 0")).toBe(false);
    expect(pins[0].label).toBe("새 핀");
    expect(await prisma.meetupPin.count({ where: { spaceId } })).toBe(21);
  });

  // 지난 만남을 소급 기록하면 그 핀이 최근 20곳 밖일 수 있다. 예전엔 같은 요청에서
  // 바로 지워졌는데 응답은 성공이었다.
  it("한도에서 지난 날짜로 기록한 핀은 남고, 보이지 않는다고 알려 준다", async () => {
    const caller = await callerFor(userAId);
    await seedPins(20);

    const created = await caller.meetup.create({
      label: "처음 만난 날",
      lat: 0,
      lng: 0,
      date: "2019-03-01",
    });
    expect(created.visible).toBe(false);
    expect(await prisma.meetupPin.findUnique({ where: { id: created.id } })).not.toBeNull();
  });

  it("프리미엄이 끝나도 모아 둔 핀은 지워지지 않고, 다시 구독하면 다 보인다", async () => {
    const caller = await callerFor(userAId);
    await seedPins(35);
    const subscription = await prisma.subscription.create({
      data: {
        spaceId,
        stripeCustomerId: `cus_${randomUUID()}`,
        stripeSubscriptionId: `sub_${randomUUID()}`,
        plan: "premium",
        status: "canceled",
        currentPeriodEnd: new Date(),
      },
    });
    try {
      await caller.meetup.create({ label: "오늘", lat: 0, lng: 0, date: "2026-10-01" });
      expect(await prisma.meetupPin.count({ where: { spaceId } })).toBe(36);
      expect((await caller.meetup.list()).hidden).toBe(16);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "active" },
      });
      const { pins, hidden } = await caller.meetup.list();
      expect(pins).toHaveLength(36);
      expect(hidden).toBe(0);
    } finally {
      await prisma.subscription.delete({ where: { id: subscription.id } });
    }
  });
});
