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
});
