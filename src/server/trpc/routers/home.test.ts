// 날씨는 실제 Open-Meteo 대신 목으로 대체한다 - 여기서 검증할 건 장면 값의
// 조합 규칙(옵트인·거리·마지막 터치·미읽음)이고, 날씨 API 자체는
// weather.test.ts가 실제 네트워크로 검증한다.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCallerFactory } from "../init";
import { appRouter } from "./_app";

vi.mock("@/lib/weather", () => ({
  fetchWeather: vi.fn(async (lat: number) => {
    if (lat < 0) throw new Error("날씨 조회 실패");
    return { temperatureC: 20, weatherCode: 0, description: "맑음" };
  }),
}));

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

describe("home 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({
        data: { email: `test-home-a-${randomUUID()}@example.com`, timezone: "Asia/Seoul" },
      }),
      prisma.user.create({
        data: { email: `test-home-b-${randomUUID()}@example.com`, timezone: "Europe/London" },
      }),
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
    await prisma.touch.deleteMany({ where: { spaceId } });
    await prisma.message.deleteMany({ where: { spaceId } });
    await prisma.locationPing.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("스페이스 멤버가 아니면 조회할 수 없다", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-home-c-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(caller.home.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  it("두 사람의 시간대·마지막 받은 터치·미읽음 수를 한 번에 돌려준다", async () => {
    await prisma.touch.create({ data: { spaceId, senderId: userBId } });
    await prisma.touch.create({
      data: { spaceId, senderId: userAId, createdAt: new Date(Date.now() + 60_000) },
    });
    await prisma.message.createMany({
      data: [
        { spaceId, senderId: userBId, content: "안녕" },
        { spaceId, senderId: userAId, content: "내가 보낸 것" },
      ],
    });

    const summary = await (await callerFor(userAId)).home.summary();

    expect(summary.me.timezone).toBe("Asia/Seoul");
    expect(summary.partner?.timezone).toBe("Europe/London");
    expect(summary.unreadCount).toBe(1);
    const partnerTouch = await prisma.touch.findFirstOrThrow({ where: { senderId: userBId } });
    expect(summary.lastTouchReceivedAt).toEqual(partnerTouch.createdAt);
  });

  it("위치공유가 꺼져 있으면 위치가 있어도 거리·날씨를 드러내지 않는다", async () => {
    await prisma.locationPing.createMany({
      data: [
        { userId: userAId, lat: 37.5665, lng: 126.978 },
        { userId: userBId, lat: 51.5072, lng: -0.1276 },
      ],
    });

    const summary = await (await callerFor(userAId)).home.summary();

    expect(summary.distanceKm).toBeNull();
    expect(summary.me.weather).toBeNull();
    expect(summary.partner?.weather).toBeNull();
  });

  it("둘 다 위치공유 중이면 마지막 위치 사이 거리와 날씨를 돌려준다", async () => {
    await prisma.user.updateMany({
      where: { id: { in: [userAId, userBId] } },
      data: { locationSharingEnabled: true },
    });
    await prisma.locationPing.createMany({
      data: [
        { userId: userAId, lat: 37.5665, lng: 126.978 },
        { userId: userBId, lat: 51.5072, lng: -0.1276 },
      ],
    });

    const summary = await (await callerFor(userAId)).home.summary();

    // 서울–런던 대권거리 약 8,850km
    expect(summary.distanceKm).toBeGreaterThan(8800);
    expect(summary.distanceKm).toBeLessThan(8900);
    expect(summary.me.weather?.description).toBe("맑음");
  });

  it("날씨 조회가 실패해도 장면 전체는 실패하지 않는다", async () => {
    await prisma.user.updateMany({
      where: { id: { in: [userAId, userBId] } },
      data: { locationSharingEnabled: true },
    });
    await prisma.locationPing.create({ data: { userId: userBId, lat: -33.8688, lng: 151.2093 } });

    const summary = await (await callerFor(userAId)).home.summary();

    expect(summary.partner?.weather).toBeNull();
    expect(summary.distanceKm).toBeNull();
  });

  it("상대에게 잘못된 시간대가 저장돼 있어도 장면과 위젯은 그 값을 내보내지 않는다", async () => {
    await prisma.user.update({ where: { id: userBId }, data: { timezone: "Not/AZone" } });
    const caller = await callerFor(userAId);

    const summary = await caller.home.summary();
    expect(summary.partner?.timezone).toBeNull();

    const widget = await caller.home.widget();
    expect(widget.partnerTimezone).toBeNull();
  });

  it("위젯 값은 날씨 없이 시간대·거리·마지막 받은 터치만 돌려준다", async () => {
    const { fetchWeather } = await import("@/lib/weather");
    vi.mocked(fetchWeather).mockClear();
    await prisma.user.updateMany({
      where: { id: { in: [userAId, userBId] } },
      data: { locationSharingEnabled: true },
    });
    await prisma.user.update({ where: { id: userBId }, data: { name: " 지우 " } });
    await prisma.locationPing.createMany({
      data: [
        { userId: userAId, lat: 37.5665, lng: 126.978 },
        { userId: userBId, lat: 51.5072, lng: -0.1276 },
      ],
    });
    const touch = await prisma.touch.create({ data: { spaceId, senderId: userBId } });

    const widget = await (await callerFor(userAId)).home.widget();

    expect(widget).toMatchObject({
      myTimezone: "Asia/Seoul",
      partnerName: "지우",
      partnerTimezone: "Europe/London",
      lastTouchReceivedAt: touch.createdAt.toISOString(),
    });
    expect(Number.isInteger(widget.distanceKm)).toBe(true);
    expect(fetchWeather).not.toHaveBeenCalled();
  });

  it("위젯도 위치공유가 꺼져 있으면 거리를 드러내지 않는다", async () => {
    await prisma.locationPing.createMany({
      data: [
        { userId: userAId, lat: 37.5665, lng: 126.978 },
        { userId: userBId, lat: 51.5072, lng: -0.1276 },
      ],
    });
    const widget = await (await callerFor(userAId)).home.widget();
    expect(widget.distanceKm).toBeNull();
    expect(widget.lastTouchReceivedAt).toBeNull();
  });
});
