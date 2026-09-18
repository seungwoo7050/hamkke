// Realtime 브로드캐스트 자체는 src/lib/supabase/realtime.test.ts에서 이미
// 검증했으므로 여기서는 send가 에러 없이 끝나는지와 DB 기록만 확인한다.
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

describe("touch 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-touch-a-${randomUUID()}@example.com` },
    });
    const b = await prisma.user.create({
      data: { email: `test-touch-b-${randomUUID()}@example.com` },
    });
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
    await prisma.touch.deleteMany({ where: { spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("스페이스 멤버가 아니면 보낼 수 없다", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-touch-outsider-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(caller.touch.send()).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  it("터치를 보내면 DB에 기록된다", async () => {
    const caller = await callerFor(userAId);
    const touch = await caller.touch.send();

    expect(touch.senderId).toBe(userAId);
    expect(touch.spaceId).toBe(spaceId);

    const stored = await prisma.touch.findUnique({ where: { id: touch.id } });
    expect(stored).not.toBeNull();
  });

  it("받은 터치가 없으면 latest는 null이다", async () => {
    const caller = await callerFor(userAId);
    expect(await caller.touch.latest()).toBeNull();
  });

  it("latest는 상대가 보낸 가장 최근 터치만 돌려주고 내가 보낸 건 제외한다", async () => {
    const older = await prisma.touch.create({
      data: { spaceId, senderId: userBId, createdAt: new Date(Date.now() - 60_000) },
    });
    const newer = await prisma.touch.create({ data: { spaceId, senderId: userBId } });
    await prisma.touch.create({
      data: { spaceId, senderId: userAId, createdAt: new Date(Date.now() + 60_000) },
    });

    const latest = await (await callerFor(userAId)).touch.latest();
    expect(latest?.id).toBe(newer.id);
    expect(latest?.id).not.toBe(older.id);
  });

  it("list는 since 이후의 터치를 보낸 사람과 무관하게 시간순으로 돌려준다", async () => {
    const since = new Date(Date.now() - 60_000);
    await prisma.touch.create({
      data: { spaceId, senderId: userBId, createdAt: new Date(Date.now() - 120_000) },
    });
    const b = await prisma.touch.create({
      data: { spaceId, senderId: userBId, createdAt: new Date(Date.now() - 30_000) },
    });
    const a = await prisma.touch.create({ data: { spaceId, senderId: userAId } });

    const list = await (await callerFor(userAId)).touch.list({ since });
    expect(list.map((t) => t.id)).toEqual([b.id, a.id]);
  });
});
