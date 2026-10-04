import { distanceKm } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { validTimeZoneOrNull } from "@/lib/timezone";
import { fetchWeather } from "@/lib/weather";
import { recordLocationProvision } from "@/server/location-provision";
import { router, spaceProcedure } from "../init";
import { serializeFlight, type FlightView } from "./flight";

const personSelect = {
  id: true,
  name: true,
  image: true,
  timezone: true,
  locationSharingEnabled: true,
} as const;

// 위치공유를 켠 쪽만 마지막 위치를 쓴다(ARCHITECTURE.md §5 옵트인 원칙,
// weather.forSpace와 동일한 규칙).
async function latestPing(userId: string, sharing: boolean) {
  if (!sharing) return null;
  return prisma.locationPing.findFirst({ where: { userId }, orderBy: { capturedAt: "desc" } });
}

// 날씨는 장면의 주변부 정보라, 외부 API가 실패해도 장면 전체가 깨지면 안 된다.
async function weatherAt(ping: { lat: number; lng: number } | null) {
  if (!ping) return null;
  return fetchWeather(ping.lat, ping.lng).catch(() => null);
}

export const homeRouter = router({
  // "우리" 장면(DESIGN.md §4)이 첫 렌더에 필요한 값을 한 번에 돌려준다.
  // 이전 /home은 서버 쿼리 5개 + 위젯별 클라이언트 쿼리로 나뉘어 있었다.
  // 실시간 갱신(위치·터치·메시지)은 기존처럼 Broadcast 구독으로 받는다.
  summary: spaceProcedure.query(async ({ ctx }) => {
    const myId = ctx.session.user.id;
    const [me, partner, lastTouch, unreadCount, flights] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: myId }, select: personSelect }),
      prisma.user.findFirst({
        where: { spaceId: ctx.space.id, id: { not: myId } },
        select: personSelect,
      }),
      prisma.touch.findFirst({
        where: { spaceId: ctx.space.id, senderId: { not: myId } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.message.count({
        where: { spaceId: ctx.space.id, senderId: { not: myId }, readAt: null },
      }),
      // 비행 중이면 장면 자체가 바뀌므로(PRD §3.3.1) 첫 렌더부터 알아야 한다 -
      // flight.list의 초기값. 커플 둘의 항공편이라 양이 적다.
      prisma.flight.findMany({
        where: { spaceId: ctx.space.id },
        orderBy: { scheduledDepartureAt: "asc" },
      }),
    ]);

    const [myPing, partnerPing] = await Promise.all([
      latestPing(me.id, me.locationSharingEnabled),
      partner ? latestPing(partner.id, partner.locationSharingEnabled) : null,
    ]);
    const [myWeather, partnerWeather] = await Promise.all([
      weatherAt(myPing),
      weatherAt(partnerPing),
    ]);

    // 상대 위치로 계산한 거리·현지 날씨가 나에게 가면 상대 위치의 제공이다(위치정보법 §16②).
    const distance = myPing && partnerPing ? distanceKm(myPing, partnerPing) : null;
    if (partner && (distance !== null || partnerWeather)) {
      await recordLocationProvision(partner.id, myId, "derived");
    }

    return {
      me: { ...me, timezone: validTimeZoneOrNull(me.timezone), weather: myWeather },
      partner: partner
        ? { ...partner, timezone: validTimeZoneOrNull(partner.timezone), weather: partnerWeather }
        : null,
      distanceKm: distance,
      lastTouchReceivedAt: lastTouch?.createdAt ?? null,
      unreadCount,
      flights: flights
        .map((f) => serializeFlight(f, ctx.locale))
        .filter((f): f is FlightView => f !== null),
    };
  }),

  // Android 홈 화면 위젯(Phase 6, /api/widget)용 - 흘끗 보는 세 가지(거리·시차·
  // 마지막 터치)만. 위젯은 30분마다 조용히 새로고침하므로 외부 날씨 API를
  // 부르지 않고, 시각은 시간대만 넘겨 위젯이 기기 시계로 직접 그린다(TextClock
  // - 새로고침 사이에도 시각이 멈추지 않게).
  widget: spaceProcedure.query(async ({ ctx }) => {
    const myId = ctx.session.user.id;
    const [me, partner, lastTouch] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: myId }, select: personSelect }),
      prisma.user.findFirst({
        where: { spaceId: ctx.space.id, id: { not: myId } },
        select: personSelect,
      }),
      prisma.touch.findFirst({
        where: { spaceId: ctx.space.id, senderId: { not: myId } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    const [myPing, partnerPing] = await Promise.all([
      latestPing(me.id, me.locationSharingEnabled),
      partner ? latestPing(partner.id, partner.locationSharingEnabled) : null,
    ]);

    // 위젯의 거리도 상대 위치로 계산해 나에게 주는 것이라 제공 사실을 남긴다(위치정보법
    // §16② - summary의 거리·날씨와 같은 derived).
    const distance = myPing && partnerPing ? Math.round(distanceKm(myPing, partnerPing)) : null;
    if (partner && distance !== null) {
      await recordLocationProvision(partner.id, myId, "derived");
    }

    return {
      myTimezone: validTimeZoneOrNull(me.timezone),
      partnerName: partner?.name?.trim() || null,
      partnerTimezone: validTimeZoneOrNull(partner?.timezone),
      distanceKm: distance,
      lastTouchReceivedAt: lastTouch?.createdAt.toISOString() ?? null,
    };
  }),
});
