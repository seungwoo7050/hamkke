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

describe("anniversary 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-anniversary-a-${randomUUID()}@example.com` },
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
    await prisma.anniversary.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("생성/조회, 기본 recurring=true가 정상 동작한다", async () => {
    const caller = await callerFor(userAId);

    const created = await caller.anniversary.create({
      title: "처음 만난 날",
      date: "2020-05-01",
    });
    expect(created.recurring).toBe(true);

    const list = await caller.anniversary.list();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("처음 만난 날");
  });

  it("recurring=false로 단발성 기념일도 만들 수 있다", async () => {
    const caller = await callerFor(userAId);
    const created = await caller.anniversary.create({
      title: "만난 지 100일",
      date: "2026-08-01",
      recurring: false,
    });
    expect(created.recurring).toBe(false);
  });

  it("삭제하면 목록에서 사라진다", async () => {
    const caller = await callerFor(userAId);
    const created = await caller.anniversary.create({ title: "삭제 예정", date: "2026-01-01" });

    await caller.anniversary.delete({ id: created.id });
    expect(await caller.anniversary.list()).toHaveLength(0);
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-anniversary-b-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(
        caller.anniversary.create({ title: "몰래", date: "2026-01-01" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
