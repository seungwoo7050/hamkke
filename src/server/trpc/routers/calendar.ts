import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { router, spaceProcedure } from "../init";

const eventInput = z
  .object({
    title: z.string().min(1).max(100),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    timezone: z.string().min(1).max(100),
  })
  .refine((data) => data.endAt >= data.startAt, {
    message: "종료 시각은 시작 시각 이후여야 해요",
    path: ["endAt"],
  });

export const calendarRouter = router({
  list: spaceProcedure.query(({ ctx }) =>
    prisma.calendarEvent.findMany({
      where: { spaceId: ctx.space.id },
      orderBy: { startAt: "asc" },
    }),
  ),

  // 클라이언트가 보내는 startAt/endAt은 이미 브라우저 로컬 타임존 기준으로
  // 만든 실제 Date(=UTC epoch)라 서버는 그대로 저장한다. timezone은 "어느
  // 기준으로 입력했는지"를 남겨두는 메타데이터일 뿐, 조회 시 변환에는
  // 각자의 User.timezone(브라우저가 다시 알려주는 값)을 쓴다.
  create: spaceProcedure.input(eventInput).mutation(({ ctx, input }) =>
    prisma.calendarEvent.create({
      data: { spaceId: ctx.space.id, createdBy: ctx.session.user.id, ...input },
    }),
  ),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.calendarEvent.deleteMany({ where: { id: input.id, spaceId: ctx.space.id } });
    return { ok: true };
  }),
});
