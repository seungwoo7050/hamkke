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

  // 받는 사람이 두 기기에서 거의 동시에 열면 두 조회가 모두 deliveredAt이 빈 것을
  // 본다. 먼저 기록된 "처음 열어 본 시각"이 덮이면 안 되고, 두 응답은 저장된 값과
  // 같아야 한다.
  it("받는 사람이 동시에 열어도 처음 열어 본 시각은 한 번만 기록된다", async () => {
    const callerB = await callerFor(userBId);
    for (let round = 0; round < 10; round++) {
      const capsule = await prisma.capsule.create({
        data: { spaceId, senderId: userAId, content: `동시 ${round}`, deliverAt: new Date(0) },
      });
      const [first, second] = await Promise.all([callerB.capsule.list(), callerB.capsule.list()]);
      const stored = await prisma.capsule.findUniqueOrThrow({ where: { id: capsule.id } });
      for (const list of [first, second]) {
        expect(list.find((c) => c.id === capsule.id)!.deliveredAt).toEqual(stored.deliveredAt);
      }
      await prisma.capsule.delete({ where: { id: capsule.id } });
    }
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

  it("무료 티어는 예약 중인(미배달) 캡슐 개수 한도를 넘으면 거부하지만, 이미 배달된 캡슐은 세지 않는다", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const caller = await callerFor(userAId);

    // 이미 배달된 것 - 한도에 포함되면 안 된다.
    await prisma.capsule.create({
      data: {
        spaceId,
        senderId: userAId,
        content: "지난 캡슐",
        deliverAt: new Date(0),
        deliveredAt: new Date(),
      },
    });
    // 미배달 3개(한도)까지는 정상 생성.
    for (let i = 0; i < 3; i++) {
      await caller.capsule.create({ content: `예약 ${i}`, deliverAt: future });
    }

    await expect(
      caller.capsule.create({ content: "한도 초과", deliverAt: future }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  // 열리는 때가 지났는데 상대가 아직 앱을 안 열어 deliveredAt이 비어 있는 캡슐은
  // 더는 "예약 중"이 아니다. 보낸 사람의 한도를 계속 차지하면 안 된다.
  it("열리는 때가 지났지만 상대가 아직 안 연 캡슐은 한도에 세지 않는다", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const caller = await callerFor(userAId);

    await prisma.capsule.create({
      data: { spaceId, senderId: userAId, content: "열렸지만 안 읽음", deliverAt: new Date(0) },
    });
    for (let i = 0; i < 3; i++) {
      await caller.capsule.create({ content: `예약 ${i}`, deliverAt: future });
    }

    await expect(
      caller.capsule.create({ content: "한도 초과", deliverAt: future }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  describe("착륙하면 열리는 편지 (PRD §3.3.1)", () => {
    async function flightOf(travelerId: string, arrivalInMs: number) {
      return prisma.flight.create({
        data: {
          spaceId,
          travelerId,
          flightNumber: "KE081",
          departureDate: new Date("2026-10-14T00:00:00Z"),
          fromIata: "ICN",
          toIata: "JFK",
          scheduledDepartureAt: new Date(Date.now() - 60_000),
          scheduledArrivalAt: new Date(Date.now() + arrivalInMs),
        },
      });
    }

    it("여는 시각은 그 항공편의 도착 시각을 따른다", async () => {
      const f = await flightOf(userBId, 3 * 3_600_000);
      const created = await (
        await callerFor(userAId)
      ).capsule.create({
        content: "도착 축하해",
        flightId: f.id,
      });
      expect(created.deliverAt).toEqual(f.scheduledArrivalAt);
      expect(created.flightId).toBe(f.id);
    });

    it("내가 타는 비행기·이미 착륙한 비행기·여는 때 둘 다 주기는 거절", async () => {
      const caller = await callerFor(userAId);
      const mine = await flightOf(userAId, 3_600_000);
      await expect(caller.capsule.create({ content: "x", flightId: mine.id })).rejects.toThrow(
        /상대가 탄/,
      );
      const landed = await flightOf(userBId, -60_000);
      await expect(caller.capsule.create({ content: "x", flightId: landed.id })).rejects.toThrow(
        /이미 착륙/,
      );
      const f = await flightOf(userBId, 3_600_000);
      await expect(
        caller.capsule.create({
          content: "x",
          flightId: f.id,
          deliverAt: new Date(Date.now() + 3_600_000).toISOString(),
        }),
      ).rejects.toThrow(/하나만/);
    });
  });
});
