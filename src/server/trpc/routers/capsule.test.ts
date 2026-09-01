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

describe("capsule 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `test-capsule-a-${randomUUID()}@example.com` } }),
      prisma.user.create({ data: { email: `test-capsule-b-${randomUUID()}@example.com` } }),
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
    await prisma.capsule.deleteMany({ where: { spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("과거 시각으로는 생성할 수 없다", async () => {
    const caller = await callerFor(userAId);
    await expect(
      caller.capsule.create({ content: "비밀", deliverAt: "2020-01-01T00:00:00Z" }),
    ).rejects.toThrow();
  });

  it("아직 배달 전이면 발신자만 내용을 볼 수 있다", async () => {
    const callerA = await callerFor(userAId);
    const callerB = await callerFor(userBId);

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await callerA.capsule.create({ content: "미래의 너에게", deliverAt: future });

    const listA = await callerA.capsule.list();
    expect(listA[0].content).toBe("미래의 너에게");

    const listB = await callerB.capsule.list();
    expect(listB[0].content).toBeNull();
    expect(listB[0].deliveredAt).toBeNull();
  });

  it("배달 시각이 지나면 수신자가 조회하는 순간 열리고 deliveredAt이 기록된다", async () => {
    const capsule = await prisma.capsule.create({
      data: {
        spaceId,
        senderId: userAId,
        content: "이미 도착했어야 할 메시지",
        deliverAt: new Date(Date.now() - 1000),
      },
    });

    const callerB = await callerFor(userBId);
    const listB = await callerB.capsule.list();
    const found = listB.find((c) => c.id === capsule.id)!;
    expect(found.content).toBe("이미 도착했어야 할 메시지");
    expect(found.deliveredAt).not.toBeNull();

    const stored = await prisma.capsule.findUniqueOrThrow({ where: { id: capsule.id } });
    expect(stored.deliveredAt).not.toBeNull();
  });

  it("발신자만 자기 캡슐을 삭제할 수 있다", async () => {
    const callerA = await callerFor(userAId);
    const callerB = await callerFor(userBId);
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const capsule = await callerA.capsule.create({ content: "삭제 테스트", deliverAt: future });

    await callerB.capsule.delete({ id: capsule.id });
    expect(await prisma.capsule.findUnique({ where: { id: capsule.id } })).not.toBeNull();

    await callerA.capsule.delete({ id: capsule.id });
    expect(await prisma.capsule.findUnique({ where: { id: capsule.id } })).toBeNull();
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-capsule-c-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await expect(
        caller.capsule.create({ content: "몰래", deliverAt: future }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
