import { distanceKm } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { fetchWeather } from "@/lib/weather";
import { router, spaceProcedure } from "../init";

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
    const [me, partner, lastTouch, unreadCount] = await Promise.all([
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
    ]);

    const [myPing, partnerPing] = await Promise.all([
      latestPing(me.id, me.locationSharingEnabled),
      partner ? latestPing(partner.id, partner.locationSharingEnabled) : null,
    ]);
    const [myWeather, partnerWeather] = await Promise.all([
      weatherAt(myPing),
      weatherAt(partnerPing),
    ]);

    return {
      me: { ...me, weather: myWeather },
      partner: partner ? { ...partner, weather: partnerWeather } : null,
      distanceKm: myPing && partnerPing ? distanceKm(myPing, partnerPing) : null,
      lastTouchReceivedAt: lastTouch?.createdAt ?? null,
      unreadCount,
    };
  }),
});
