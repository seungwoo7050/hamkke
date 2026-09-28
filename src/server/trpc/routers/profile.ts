import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { isValidTimeZone, validTimeZoneOrNull } from "@/lib/timezone";
import { protectedProcedure, router, spaceProcedure } from "../init";

export const profileRouter = router({
  // 브라우저가 감지한 IANA 타임존으로 동기화한다(시차 위젯용). 사용자가
  // 여행 등으로 위치를 옮기면 다음 로그인 때 자동으로 갱신된다.
  setTimezone: protectedProcedure
    .input(z.object({ timezone: z.string().min(1).max(100).refine(isValidTimeZone) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { timezone: input.timezone },
      });
      return { timezone: input.timezone };
    }),

  // 화면·알림 언어(PRD §3.8). 사람마다 따로라 내 것만 바꾼다 - 상대 화면은 그대로.
  setLocale: protectedProcedure
    .input(z.object({ locale: z.enum(LOCALES) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { locale: input.locale },
      });
      return { locale: input.locale };
    }),

  // 기기 언어 - 화면은 요청마다 Accept-Language로 정하지만 푸시는 요청 밖에서
  // 만들어지므로, 언어를 고르지 않은 사람의 푸시도 화면과 같은 언어가 되게 알아 둔다.
  // 지원하지 않는 언어면 null(한국어 기본).
  setDeviceLocale: protectedProcedure
    .input(z.object({ locale: z.enum(LOCALES).nullable() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { deviceLocale: input.locale },
      });
      return { locale: input.locale };
    }),

  timezones: spaceProcedure.query(async ({ ctx }) => {
    const [me, partner] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { timezone: true },
      }),
      prisma.user.findFirst({
        where: { spaceId: ctx.space.id, id: { not: ctx.session.user.id } },
        select: { timezone: true },
      }),
    ]);
    return {
      me: validTimeZoneOrNull(me.timezone),
      partner: validTimeZoneOrNull(partner?.timezone),
    };
  }),
});
