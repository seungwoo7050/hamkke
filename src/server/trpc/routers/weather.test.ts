// 실제 Open-Meteo API를 호출한다(키 불필요). 네트워크가 필요하다.
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

describe("weather 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `test-weather-a-${randomUUID()}@example.com` } }),
      prisma.user.create({ data: { email: `test-weather-b-${randomUUID()}@example.com` } }),
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
    await prisma.locationPing.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("위치공유가 꺼져 있으면 날씨는 null이다", async () => {
    const caller = await callerFor(userAId);
    const result = await caller.weather.forSpace();
    expect(result).toEqual({ me: null, partner: null });
  });

  it("위치공유가 켜진 쪽만 실제 좌표로 날씨를 조회해 돌려준다", async () => {
    await prisma.user.update({ where: { id: userAId }, data: { locationSharingEnabled: true } });
    await prisma.locationPing.create({
      data: { userId: userAId, lat: 37.5665, lng: 126.978 },
    });

    const caller = await callerFor(userAId);
    const result = await caller.weather.forSpace();

    expect(result.partner).toBeNull();
    expect(result.me).not.toBeNull();
    expect(typeof result.me?.temperatureC).toBe("number");
    expect(typeof result.me?.description).toBe("string");
  });
});
