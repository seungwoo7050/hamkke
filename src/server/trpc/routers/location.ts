import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { distanceKm } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { sendPushToSpacePartner } from "@/lib/push";
import { spaceChannelName } from "@/lib/supabase/channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { router, spaceProcedure } from "../init";
import type { TRPCContext } from "../context";
import { translator } from "@/i18n/server";

type SpaceCtx = { space: { id: string }; session: NonNullable<TRPCContext["session"]> };

// 반경 재진입(밖→안) 때만 알림을 보내고, 반경 안에 머무는 동안은
// isInside=true로 남겨둬 중복 알림을 막는다.
async function checkGeofenceArrivals(ctx: SpaceCtx, position: { lat: number; lng: number }) {
  const fences = await prisma.geofence.findMany({ where: { userId: ctx.session.user.id } });

  for (const fence of fences) {
    const withinRadius = distanceKm(position, fence) * 1000 <= fence.radiusM;
    if (withinRadius === fence.isInside) continue;

    await prisma.geofence.update({ where: { id: fence.id }, data: { isInside: withinRadius } });

    if (withinRadius) {
      await sendPushToSpacePartner(ctx.space.id, ctx.session.user.id, (t) => ({
        title: "Hamkke",
        body: t("push.geofence", { label: fence.label }),
      })).catch(() => {});
    }
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

      const supabase = createSupabaseServerClient();
      await supabase.channel(spaceChannelName(ctx.space.id)).send({
        type: "broadcast",
        event: "location-sharing",
        payload: { userId: ctx.session.user.id, enabled: input.enabled },
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

      const ping = await prisma.locationPing.create({
        data: {
          userId: ctx.session.user.id,
          lat: input.lat,
          lng: input.lng,
          accuracy: input.accuracy,
        },
      });

      const supabase = createSupabaseServerClient();
      await supabase.channel(spaceChannelName(ctx.space.id)).send({
        type: "broadcast",
        event: "location",
        payload: ping,
      });

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
