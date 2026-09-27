import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { distanceKm } from "@/lib/geo";
import { nextGeofenceState } from "@/lib/geofence";
import { prisma } from "@/lib/prisma";
import { sendPushToSpacePartner } from "@/lib/push";
import { broadcastToSpace } from "@/lib/supabase/broadcast";
import { router, spaceProcedure } from "../init";
import type { TRPCContext } from "../context";
import { translator } from "@/i18n/server";
import { consume } from "@/server/rate-limit";
import { LOCATION_PING_RETENTION_MS, locationSendCheck } from "@/server/request-limits";

type SpaceCtx = { space: { id: string }; session: NonNullable<TRPCContext["session"]> };

// 반경 재진입(밖→안) 때만 알림을 보내고, 반경 안에 머무는 동안은
// isInside=true로 남겨둬 중복 알림을 막는다. 안/밖 기준은 nextGeofenceState가
// GPS 흔들림을 감안해 정한다.
async function checkGeofenceArrivals(
  ctx: SpaceCtx,
  position: { lat: number; lng: number; accuracy?: number },
) {
  const fences = await prisma.geofence.findMany({ where: { userId: ctx.session.user.id } });

  for (const fence of fences) {
    const distanceM = distanceKm(position, fence) * 1000;
    const isInside = nextGeofenceState(fence, distanceM, position.accuracy);
    if (isInside === fence.isInside) continue;

    // 같은 사람의 위치가 겹쳐 들어와도 상태를 바꾼 요청 하나만 알림을 보낸다.
    const { count } = await prisma.geofence.updateMany({
      where: { id: fence.id, isInside: fence.isInside },
      data: { isInside },
    });
    if (count === 0 || !isInside) continue;

    await sendPushToSpacePartner(ctx.space.id, ctx.session.user.id, (t) => ({
      title: "Hamkke",
      body: t("push.geofence", { label: fence.label }),
    })).catch(() => {});
  }
}

export const locationRouter = router({
  // 위치공유는 반드시 사용자가 명시적으로 켜야 한다(ARCHITECTURE.md §5).
  // 꺼짐 상태도 상대에게 알려야 지도에서 "위치공유 꺼짐"을 표시할 수 있다.
  setSharing: spaceProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { locationSharingEnabled: input.enabled },
      });
      // 끄면 지금까지의 위치 기록을 지운다. 기록은 공유가 켜져 있을 때만 읽히고(장면·
      // 날씨·상대 화면), 꺼진 동안엔 저장이 없어 아래 7일 정리도 돌지 않으므로, 남겨 두면
      // 마지막 한 주의 기록이 영영 남는다.
      if (!input.enabled) {
        await prisma.locationPing.deleteMany({ where: { userId: ctx.session.user.id } });
      }

      await broadcastToSpace(ctx.space.id, "location-sharing", {
        userId: ctx.session.user.id,
        enabled: input.enabled,
      });

      return { enabled: input.enabled };
    }),

  mySharing: spaceProcedure.query(async ({ ctx }) => {
    const me = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: { locationSharingEnabled: true },
    });
    return me.locationSharingEnabled;
  }),

  send: spaceProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy: z.number().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await prisma.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { locationSharingEnabled: true },
      });
      if (!me.locationSharingEnabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: translator(ctx.locale)("errors.sharingOff"),
        });
      }

      // 너무 잦은 전송은 저장·브로드캐스트·지오펜스 확인 없이 무시하고 마지막
      // 스냅샷을 돌려준다 — 오류로 돌려주면 정상 화면도 토스트가 뜰 수 있어서.
      const userId = ctx.session.user.id;
      if ((await consume(locationSendCheck(userId))) > 0) {
        const last = await prisma.locationPing.findFirst({
          where: { userId },
          orderBy: { capturedAt: "desc" },
        });
        if (last) return last;
      }

      const ping = await prisma.locationPing.create({
        data: {
          userId,
          lat: input.lat,
          lng: input.lng,
          accuracy: input.accuracy,
        },
      });
      // 보관 기간이 지난 스냅샷은 저장할 때마다 정리한다(스케줄러 없이). 공유는 켜 둔 채
      // 앱을 안 쓰는 사람의 기록도 지워지게 스페이스 두 사람 모두를 본다.
      await prisma.locationPing.deleteMany({
        where: {
          user: { spaceId: ctx.space.id },
          capturedAt: { lt: new Date(Date.now() - LOCATION_PING_RETENTION_MS) },
        },
      });

      await broadcastToSpace(ctx.space.id, "location", ping);

      await checkGeofenceArrivals(ctx, input);

      return ping;
    }),

  // 페이지를 새로 열었을 때 상대의 현재 공유 상태 + 마지막 위치를 초기값으로
  // 쓴다. 이후 실시간 갱신은 Broadcast 구독으로 받는다.
  partnerStatus: spaceProcedure.query(async ({ ctx }) => {
    const partner = await prisma.user.findFirst({
      where: { spaceId: ctx.space.id, id: { not: ctx.session.user.id } },
      select: { id: true, locationSharingEnabled: true },
    });
    if (!partner) return null;

    const location = partner.locationSharingEnabled
      ? await prisma.locationPing.findFirst({
          where: { userId: partner.id },
          orderBy: { capturedAt: "desc" },
        })
      : null;

    return { sharing: partner.locationSharingEnabled, location };
  }),
});
