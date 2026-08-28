// Realtime 브로드캐스트 자체는 src/lib/supabase/realtime.test.ts에서 이미
// 검증했으므로 여기서는 위치공유 온/오프 강제, DB 기록, partnerStatus 조회
// 로직만 확인한다.
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

describe("location 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `test-location-a-${randomUUID()}@example.com` } }),
      prisma.user.create({ data: { email: `test-location-b-${randomUUID()}@example.com` } }),
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

  it("위치공유를 켜기 전에는 send가 거부된다", async () => {
    const caller = await callerFor(userAId);
    await expect(caller.location.send({ lat: 37.5, lng: 127.0 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("setSharing으로 켠 뒤에만 위치를 보낼 수 있고 DB에 기록된다", async () => {
    const caller = await callerFor(userAId);

    const { enabled } = await caller.location.setSharing({ enabled: true });
    expect(enabled).toBe(true);
    expect(await caller.location.mySharing()).toBe(true);

    const ping = await caller.location.send({ lat: 37.5665, lng: 126.978, accuracy: 12.5 });
    expect(ping.userId).toBe(userAId);

    const stored = await prisma.locationPing.findUnique({ where: { id: ping.id } });
    expect(stored?.lat).toBeCloseTo(37.5665);
    expect(stored?.lng).toBeCloseTo(126.978);
  });

  it("partnerStatus는 상대가 공유 중일 때만 최신 위치를 돌려준다", async () => {
    const callerA = await callerFor(userAId);
    const callerB = await callerFor(userBId);

    const offlineStatus = await callerB.location.partnerStatus();
    expect(offlineStatus).toEqual({ sharing: false, location: null });

    await callerA.location.setSharing({ enabled: true });
    await callerA.location.send({ lat: 35.1796, lng: 129.0756 });

    const onlineStatus = await callerB.location.partnerStatus();
    expect(onlineStatus?.sharing).toBe(true);
    expect(onlineStatus?.location?.lat).toBeCloseTo(35.1796);
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-location-c-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(caller.location.setSharing({ enabled: true })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
