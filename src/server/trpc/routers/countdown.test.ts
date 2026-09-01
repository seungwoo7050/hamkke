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
  });
}

describe("countdown 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-countdown-a-${randomUUID()}@example.com` },
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
    await prisma.countdown.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("생성/조회가 목표일 오름차순으로 정상 동작한다", async () => {
    const caller = await callerFor(userAId);

    await caller.countdown.create({ title: "다음 여행", targetDate: "2026-12-25" });
    await caller.countdown.create({ title: "다음 만남", targetDate: "2026-10-10" });

    const list = await caller.countdown.list();
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe("다음 만남");
    expect(list[1].title).toBe("다음 여행");
  });

  it("삭제하면 목록에서 사라진다", async () => {
    const caller = await callerFor(userAId);
    const created = await caller.countdown.create({ title: "삭제 예정", targetDate: "2026-01-01" });

    await caller.countdown.delete({ id: created.id });
    expect(await caller.countdown.list()).toHaveLength(0);
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-countdown-b-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(
        caller.countdown.create({ title: "몰래", targetDate: "2026-01-01" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
