import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { spaceChannelName } from "@/lib/supabase/channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { router, spaceProcedure } from "../init";

export const chatRouter = router({
  // 이미지/음성 메시지는 R2 업로드 연동이 생기는 다음 커밋들에서 별도로 추가한다.
  send: spaceProcedure
    .input(z.object({ content: z.string().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const message = await prisma.message.create({
        data: {
          spaceId: ctx.space.id,
          senderId: ctx.session.user.id,
          type: "text",
          content: input.content,
        },
      });

      const supabase = createSupabaseServerClient();
      await supabase.channel(spaceChannelName(ctx.space.id)).send({
        type: "broadcast",
        event: "message",
        payload: message,
      });

      return message;
    }),

  list: spaceProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await prisma.message.findMany({
        where: { spaceId: ctx.space.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (rows.length > input.limit) {
        nextCursor = rows.pop()!.id;
      }

      // 화면에는 오래된 → 최신 순으로 표시.
      return { messages: rows.reverse(), nextCursor };
    }),

  // 상대가 보낸, 아직 안 읽은 메시지를 전부 읽음 처리하고 상대 화면에
  // "읽음" 표시가 즉시 뜨도록 브로드캐스트한다.
  markRead: spaceProcedure.mutation(async ({ ctx }) => {
    const readAt = new Date();
    await prisma.message.updateMany({
      where: { spaceId: ctx.space.id, senderId: { not: ctx.session.user.id }, readAt: null },
      data: { readAt },
    });

    const supabase = createSupabaseServerClient();
    await supabase.channel(spaceChannelName(ctx.space.id)).send({
      type: "broadcast",
      event: "read",
      payload: { readAt: readAt.toISOString(), readBy: ctx.session.user.id },
    });

    return { readAt };
  }),
});
