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

describe("profile 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `test-profile-a-${randomUUID()}@example.com` } }),
      prisma.user.create({ data: { email: `test-profile-b-${randomUUID()}@example.com` } }),
    ]);
    userAId = a.id;
    userBId = b.id;

    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    spaceId = space.id;
    await prisma.user.updateMany({ where: { id: { in: [userAId, userBId] } }, data: { spaceId } });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("setTimezone은 로그인만 하면 되고(Space 불필요) DB에 반영된다", async () => {
    const caller = await callerFor(userAId);
    const { timezone } = await caller.profile.setTimezone({ timezone: "Asia/Seoul" });
    expect(timezone).toBe("Asia/Seoul");

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: userAId } });
    expect(stored.timezone).toBe("Asia/Seoul");
  });

  it("setTimezone은 IANA에 없는 시간대 이름을 저장하지 않는다", async () => {
    const caller = await callerFor(userAId);
    await expect(caller.profile.setTimezone({ timezone: "Not/AZone" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: userAId } });
    expect(stored.timezone).toBeNull();
  });

  it("timezones는 이미 저장된 잘못된 시간대를 null로 돌려준다", async () => {
    await prisma.user.update({ where: { id: userBId }, data: { timezone: "Not/AZone" } });
    const result = await (await callerFor(userAId)).profile.timezones();
    expect(result.partner).toBeNull();
  });

  it("timezones는 내 타임존과 상대 타임존을 함께 돌려준다", async () => {
    await prisma.user.update({ where: { id: userAId }, data: { timezone: "Asia/Seoul" } });
    await prisma.user.update({
      where: { id: userBId },
      data: { timezone: "America/Los_Angeles" },
    });

    const caller = await callerFor(userAId);
    const result = await caller.profile.timezones();
    expect(result).toEqual({ me: "Asia/Seoul", partner: "America/Los_Angeles" });
  });

  it("setDeviceLocale은 기기 언어를 지원 언어로만 기록하고, 고른 언어는 건드리지 않는다", async () => {
    const caller = await callerFor(userAId);
    await caller.profile.setLocale({ locale: "ko" });
    await caller.profile.setDeviceLocale({ locale: "en" });
    let me = await prisma.user.findUniqueOrThrow({ where: { id: userAId } });
    expect([me.locale, me.deviceLocale]).toEqual(["ko", "en"]);

    // 지원하지 않는 기기 언어(예: 일본어)는 null로 - 그땐 한국어가 기본이다.
    await caller.profile.setDeviceLocale({ locale: null });
    me = await prisma.user.findUniqueOrThrow({ where: { id: userAId } });
    expect(me.deviceLocale).toBeNull();
    await expect(
      caller.profile.setDeviceLocale({ locale: "ja" as unknown as "en" }),
    ).rejects.toThrow();
  });

  it("setLocale은 내 언어만 바꾸고, 지원하지 않는 언어는 거절한다", async () => {
    const caller = await callerFor(userAId);
    await caller.profile.setLocale({ locale: "en" });
    const [a, b] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userAId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userBId } }),
    ]);
    expect(a.locale).toBe("en");
    expect(b.locale).toBeNull();
    await expect(caller.profile.setLocale({ locale: "fr" as never })).rejects.toThrow();
  });
});
