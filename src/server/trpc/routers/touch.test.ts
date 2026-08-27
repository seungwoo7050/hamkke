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
  });
}

describe("touch 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-touch-a-${randomUUID()}@example.com` },
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
    await prisma.touch.deleteMany({ where: { spaceId } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("스페이스 멤버가 아니면 보낼 수 없다", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-touch-b-${randomUUID()}@example.com` },
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
});
