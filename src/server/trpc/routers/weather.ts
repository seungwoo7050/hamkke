import { prisma } from "@/lib/prisma";
import { fetchWeather } from "@/lib/weather";
import { router, spaceProcedure } from "../init";

async function latestWeather(userId: string, sharing: boolean) {
  if (!sharing) return null;
  const ping = await prisma.locationPing.findFirst({
    where: { userId },
    orderBy: { capturedAt: "desc" },
  });
  if (!ping) return null;
  return fetchWeather(ping.lat, ping.lng);
}

export const weatherRouter = router({
  // 위치공유가 켜져 있는 쪽만 날씨를 보여준다 - 날씨 자체가 위치를
  // 드러내는 정보라 옵트인 원칙(ARCHITECTURE.md §5)을 그대로 따른다.
  forSpace: spaceProcedure.query(async ({ ctx }) => {
    const [me, partner] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { locationSharingEnabled: true },
      }),
      prisma.user.findFirst({
        where: { spaceId: ctx.space.id, id: { not: ctx.session.user.id } },
        select: { id: true, locationSharingEnabled: true },
      }),
    ]);

    const [myWeather, partnerWeather] = await Promise.all([
      latestWeather(ctx.session.user.id, me.locationSharingEnabled),
      partner ? latestWeather(partner.id, partner.locationSharingEnabled) : null,
    ]);

    return { me: myWeather, partner: partnerWeather };
  }),
});
