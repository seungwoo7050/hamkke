import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCallerFactory } from "../init";
import { appRouter } from "./_app";

const createCaller = createCallerFactory(appRouter);

async function callerFor(userId: string, locale?: "ko" | "en") {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createCaller({
    session: {
      user: { id: user.id, spaceId: user.spaceId, name: null, email: null, image: null },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    baseUrl: "http://localhost:3000",
    locale,
  });
}

const KE081 = {
  traveler: "partner" as const,
  flightNumber: "ke 081",
  departureDate: "2026-10-14",
  fromIata: "icn",
  toIata: "JFK",
  departureTime: "10:30",
  arrivalTime: "11:20",
};

describe("flight 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `test-flight-a-${randomUUID()}@example.com` } }),
      prisma.user.create({ data: { email: `test-flight-b-${randomUUID()}@example.com` } }),
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
    await prisma.space.delete({ where: { id: spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  it("탑승권에 적힌 그대로 받아 UTC로 저장하고, 공항 정보·거리를 붙여 돌려준다", async () => {
    const created = await (await callerFor(userAId)).flight.create(KE081);

    expect(created).toMatchObject({
      travelerId: userBId,
      flightNumber: "KE081",
      from: { iata: "ICN", city: "인천", timeZone: "Asia/Seoul" },
      to: { iata: "JFK", city: "뉴욕" },
    });
    expect(created.scheduledDepartureAt.toISOString()).toBe("2026-10-14T01:30:00.000Z");
    expect(created.scheduledArrivalAt.toISOString()).toBe("2026-10-14T15:20:00.000Z");
    expect(created.distanceKm).toBeGreaterThan(11000);

    // 상대에게도 같은 항공편이 보인다(스페이스 단위).
    const list = await (await callerFor(userBId)).flight.list();
    expect(list.map((f) => f.id)).toEqual([created.id]);
  });

  it("잘못된 편명·공항·도착 시각은 한국어로 거절한다", async () => {
    const caller = await callerFor(userAId);
    await expect(caller.flight.create({ ...KE081, flightNumber: "KOREAN" })).rejects.toThrow(
      /편명/,
    );
    await expect(caller.flight.create({ ...KE081, toIata: "ZZZ" })).rejects.toThrow(/공항/);
    await expect(caller.flight.create({ ...KE081, toIata: "ICN" })).rejects.toThrow(/같아요/);
    await expect(
      caller.flight.create({ ...KE081, toIata: "GMP", arrivalTime: "10:29" }),
    ).rejects.toThrow(/20시간/);
  });

  it("시각을 고치면 아직 안 열린 착륙 편지도 함께 옮긴다", async () => {
    const caller = await callerFor(userAId);
    const f = await caller.flight.create(KE081);
    const capsule = await prisma.capsule.create({
      data: {
        spaceId,
        senderId: userAId,
        content: "도착 축하해",
        deliverAt: f.scheduledArrivalAt,
        flightId: f.id,
      },
    });

    await caller.flight.update({ ...KE081, id: f.id, arrivalTime: "12:05" });

    const moved = await prisma.capsule.findUniqueOrThrow({ where: { id: capsule.id } });
    expect(moved.deliverAt.toISOString()).toBe("2026-10-14T16:05:00.000Z");
  });

  it("항공편을 지워도 편지는 남는다", async () => {
    const caller = await callerFor(userAId);
    const f = await caller.flight.create(KE081);
    const capsule = await prisma.capsule.create({
      data: {
        spaceId,
        senderId: userAId,
        content: "x",
        deliverAt: f.scheduledArrivalAt,
        flightId: f.id,
      },
    });
    await caller.flight.delete({ id: f.id });
    expect(await caller.flight.list()).toEqual([]);
    expect(
      (await prisma.capsule.findUniqueOrThrow({ where: { id: capsule.id } })).flightId,
    ).toBeNull();
  });

  it("다른 스페이스의 항공편은 고칠 수 없다", async () => {
    const f = await (await callerFor(userAId)).flight.create(KE081);
    const outsider = await prisma.user.create({
      data: { email: `test-flight-c-${randomUUID()}@example.com` },
    });
    try {
      await expect((await callerFor(outsider.id)).flight.list()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
    expect(f.id).toBeTruthy();
  });

  it("공항 검색", async () => {
    const results = await (await callerFor(userAId)).flight.searchAirports({ q: "뉴욕" });
    expect(results.map((a) => a.iata)).toContain("JFK");
  });

  it("에러 문구는 요청자의 언어로(ARCHITECTURE §12)", async () => {
    await expect(
      (await callerFor(userAId, "en")).flight.create({ ...KE081, flightNumber: "KOREAN" }),
    ).rejects.toThrow("Check the flight number (e.g. KE081)");
    await expect(
      (await callerFor(userAId, "ko")).flight.create({ ...KE081, flightNumber: "KOREAN" }),
    ).rejects.toThrow("편명을 확인해 주세요(예: KE081)");
  });
});
