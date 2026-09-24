import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fromZonedLocal, todayIn } from "@/lib/datetime";
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

describe("streak 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-streak-a-${randomUUID()}@example.com` },
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
    await prisma.message.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  async function messageAt(createdAt: Date) {
    await prisma.message.create({
      data: { spaceId, senderId: userAId, type: "text", content: "대화", createdAt },
    });
  }

  it("기간 상한 없이 센다 — 70일 연속이면 70", async () => {
    const now = Date.now();
    for (let i = 0; i < 70; i++) {
      // 하루에 여러 번 보내도 하루로 센다.
      await messageAt(new Date(now - i * 86_400_000));
      await messageAt(new Date(now - i * 86_400_000 - 60_000));
    }

    const result = await (await callerFor(userAId)).streak.current({ timeZone: "UTC" });
    expect(result).toEqual({ streak: 70, activeToday: true });
  });

  it("하루 경계는 보는 사람의 시간대로 자른다", async () => {
    // 서울 기준 오늘 00:30과 어제 23:30 — UTC로는 같은 날(어제) 15:30, 14:30이다.
    const { y, m, d } = todayIn("Asia/Seoul", new Date());
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayMidnightKst = fromZonedLocal(`${y}-${pad(m)}-${pad(d)}T00:00`, "Asia/Seoul");
    await messageAt(new Date(todayMidnightKst.getTime() + 30 * 60_000));
    await messageAt(new Date(todayMidnightKst.getTime() - 30 * 60_000));

    const caller = await callerFor(userAId);
    expect(await caller.streak.current({ timeZone: "Asia/Seoul" })).toEqual({
      streak: 2,
      activeToday: true,
    });
    expect((await caller.streak.current({ timeZone: "UTC" })).streak).toBe(1);
  });

  it("모르는 시간대 이름은 거부한다", async () => {
    await expect(
      (await callerFor(userAId)).streak.current({ timeZone: "Not/AZone" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-streak-b-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(caller.streak.current({ timeZone: "UTC" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
