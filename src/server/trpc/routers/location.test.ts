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
    baseUrl: "http://localhost:3000",
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

  // 서버 빈도 제한(10초에 한 번)이 지난 것처럼 기록 시각을 과거로 돌린다.
  async function afterThrottle(userId: string) {
    await prisma.rateLimitHit.updateMany({
      where: { bucket: "location.send", subject: userId },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
  }

  afterEach(async () => {
    await prisma.rateLimitHit.deleteMany({ where: { subject: { in: [userAId, userBId] } } });
    await prisma.geofence.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
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

    const { enabled } = await caller.location.setSharing({ enabled: true, consent: true });
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

    await callerA.location.setSharing({ enabled: true, consent: true });
    await callerA.location.send({ lat: 35.1796, lng: 129.0756 });

    const onlineStatus = await callerB.location.partnerStatus();
    expect(onlineStatus?.sharing).toBe(true);
    expect(onlineStatus?.location?.lat).toBeCloseTo(35.1796);
  });

  it("지오펜스를 벗어났다가 다시 반경에 들어오면 isInside가 true로 바뀐다", async () => {
    const caller = await callerFor(userAId);
    await caller.location.setSharing({ enabled: true, consent: true });

    // "현재 위치로 등록" - 만든 사람은 이미 그 안에 있다.
    const fence = await caller.geofence.create({
      label: "집",
      lat: 37.5665,
      lng: 126.978,
      radiusM: 500,
    });
    expect(fence.isInside).toBe(true);

    // 반경 밖(약 300km 떨어진 부산) → 밖으로.
    await caller.location.send({ lat: 35.1796, lng: 129.0756 });
    expect((await prisma.geofence.findUniqueOrThrow({ where: { id: fence.id } })).isInside).toBe(
      false,
    );

    // 반경 안(거의 같은 좌표) → 진입으로 전이.
    await afterThrottle(userAId);
    await caller.location.send({ lat: 37.5666, lng: 126.9781 });
    expect((await prisma.geofence.findUniqueOrThrow({ where: { id: fence.id } })).isInside).toBe(
      true,
    );
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-location-c-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(
        caller.location.setSharing({ enabled: true, consent: true }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  it("10초 안에 다시 보내면 저장·지오펜스 확인 없이 마지막 위치를 돌려준다", async () => {
    const caller = await callerFor(userAId);
    await caller.location.setSharing({ enabled: true, consent: true });
    const fence = await caller.geofence.create({
      label: "집",
      lat: 37.5665,
      lng: 126.978,
      radiusM: 500,
    });

    const first = await caller.location.send({ lat: 35.1796, lng: 129.0756 });
    const second = await caller.location.send({ lat: 37.5666, lng: 126.9781 });

    expect(second.id).toBe(first.id);
    expect(await prisma.locationPing.count({ where: { userId: userAId } })).toBe(1);
    expect((await prisma.geofence.findUniqueOrThrow({ where: { id: fence.id } })).isInside).toBe(
      false,
    );
  });

  it("7일 지난 위치 기록은 새로 저장할 때 지워진다", async () => {
    const caller = await callerFor(userAId);
    await caller.location.setSharing({ enabled: true, consent: true });
    const old = await prisma.locationPing.create({
      data: { userId: userAId, lat: 1, lng: 1, capturedAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    const recent = await prisma.locationPing.create({
      data: { userId: userAId, lat: 2, lng: 2, capturedAt: new Date(Date.now() - 86_400_000) },
    });

    await caller.location.send({ lat: 37.5, lng: 127 });

    expect(await prisma.locationPing.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.locationPing.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  // 정리가 "그 사람이 새로 저장할 때"에만 일어나면, 공유를 끄거나 앱을 안 쓰는 사람의
  // 기록은 7일이 지나도 남는다.
  it("위치공유를 끄면 내 위치 기록을 지운다", async () => {
    const caller = await callerFor(userAId);
    await caller.location.setSharing({ enabled: true, consent: true });
    await caller.location.send({ lat: 37.5, lng: 127 });

    await caller.location.setSharing({ enabled: false });

    expect(await prisma.locationPing.count({ where: { userId: userAId } })).toBe(0);
  });

  it("약관 동의 없이는 켤 수 없고, 켜면 동의 시각을 남기며, 끄면 동의도 지운다", async () => {
    const caller = await callerFor(userAId);
    await expect(caller.location.setSharing({ enabled: true })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(
      caller.location.setSharing({ enabled: true, consent: false }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const consentOf = async () =>
      (await prisma.user.findUniqueOrThrow({ where: { id: userAId } })).locationConsentAt;
    expect(await consentOf()).toBeNull();

    await caller.location.setSharing({ enabled: true, consent: true });
    expect(await consentOf()).toBeInstanceOf(Date);

    await caller.location.setSharing({ enabled: false });
    expect(await consentOf()).toBeNull();
  });

  it("저장할 때 상대의 7일 지난 기록도 지운다", async () => {
    const old = await prisma.locationPing.create({
      data: { userId: userBId, lat: 1, lng: 1, capturedAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    const caller = await callerFor(userAId);
    await caller.location.setSharing({ enabled: true, consent: true });

    await caller.location.send({ lat: 37.5, lng: 127 });

    expect(await prisma.locationPing.findUnique({ where: { id: old.id } })).toBeNull();
  });

  describe("위치 제공 사실 확인자료(위치정보법 §16②)", () => {
    const provisions = () =>
      prisma.locationProvision.findMany({
        where: { subjectId: userAId },
        orderBy: { kind: "asc" },
      });

    it("내 위치가 상대에게 가면(실시간·최근 위치) 받은 사람과 종류가 기록된다", async () => {
      const callerA = await callerFor(userAId);
      await callerA.location.setSharing({ enabled: true, consent: true });
      await callerA.location.send({ lat: 37.5, lng: 127 });
      await (await callerFor(userBId)).location.partnerStatus();

      const rows = await provisions();
      expect(rows.map((r) => [r.kind, r.recipientId, r.count])).toEqual([
        ["live", userBId, 1],
        ["latest", userBId, 1],
      ]);
    });

    it("상대가 공유를 꺼 위치를 받지 못하면 기록하지 않는다", async () => {
      await (await callerFor(userBId)).location.partnerStatus();
      expect(await provisions()).toEqual([]);
    });

    it("공유를 끄면(동의 철회) 확인자료도 지운다", async () => {
      const callerA = await callerFor(userAId);
      await callerA.location.setSharing({ enabled: true, consent: true });
      await callerA.location.send({ lat: 37.5, lng: 127 });
      expect(await provisions()).toHaveLength(1);

      await callerA.location.setSharing({ enabled: false });
      expect(await provisions()).toEqual([]);
    });
  });
});
