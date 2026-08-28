import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPushToSpacePartner } from "@/lib/push";
import { createDownloadUrl, createUploadUrl } from "@/lib/r2";
import { spaceChannelName } from "@/lib/supabase/channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { router, spaceProcedure } from "../init";
import type { TRPCContext } from "../context";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"] as const;

// image/voice 메시지는 content에 R2 오브젝트 키를 저장하고, 표시할 때만
// 짧게 유효한 signed URL로 즉석 변환한다(ARCHITECTURE.md §10 — 영구 public
// URL 금지).
async function resolveContent(message: { type: string; content: string }) {
  if (message.type === "text") return message.content;
  return createDownloadUrl(message.content);
}

type SpaceCtx = { space: { id: string }; session: NonNullable<TRPCContext["session"]> };

const PUSH_BODY_BY_TYPE: Record<"image" | "voice", string> = {
  image: "사진을 보냈어요",
  voice: "음성 메시지를 보냈어요",
};

async function createAndBroadcastMediaMessage(ctx: SpaceCtx, type: "image" | "voice", key: string) {
  const message = await prisma.message.create({
    data: { spaceId: ctx.space.id, senderId: ctx.session.user.id, type, content: key },
  });
  const content = await resolveContent(message);

  const supabase = createSupabaseServerClient();
  await supabase.channel(spaceChannelName(ctx.space.id)).send({
    type: "broadcast",
    event: "message",
    payload: { ...message, content },
  });

  // 상대가 탭을 닫아뒀거나 백그라운드에 있어도 받을 수 있도록 푸시도 시도한다.
  await sendPushToSpacePartner(ctx.space.id, ctx.session.user.id, {
    title: "Hamkke",
    body: PUSH_BODY_BY_TYPE[type],
  }).catch(() => {});

  return { ...message, content };
}

export const chatRouter = router({
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

      // 상대가 탭을 닫아뒀거나 백그라운드에 있어도 받을 수 있도록 푸시도 시도한다.
      await sendPushToSpacePartner(ctx.space.id, ctx.session.user.id, {
        title: "Hamkke",
        body: input.content.length > 40 ? `${input.content.slice(0, 40)}…` : input.content,
      }).catch(() => {});

      return message;
    }),

  // R2에 직접 업로드할 presigned PUT URL 발급. 서버는 파일 바이트를
  // 거치지 않는다 — 클라이언트가 이 URL로 R2에 바로 PUT한다.
  createImageUploadUrl: spaceProcedure
    .input(z.object({ contentType: z.enum(ALLOWED_IMAGE_TYPES) }))
    .mutation(async ({ ctx, input }) => {
      const key = `messages/${ctx.space.id}/${randomUUID()}`;
      const uploadUrl = await createUploadUrl(key, input.contentType);
      return { uploadUrl, key };
    }),

  sendImage: spaceProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(({ ctx, input }) => createAndBroadcastMediaMessage(ctx, "image", input.key)),

  createVoiceUploadUrl: spaceProcedure
    .input(z.object({ contentType: z.enum(ALLOWED_AUDIO_TYPES) }))
    .mutation(async ({ ctx, input }) => {
      const key = `messages/${ctx.space.id}/${randomUUID()}`;
      const uploadUrl = await createUploadUrl(key, input.contentType);
      return { uploadUrl, key };
    }),

  sendVoice: spaceProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(({ ctx, input }) => createAndBroadcastMediaMessage(ctx, "voice", input.key)),

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

      const messages = await Promise.all(
        rows.map(async (row) => ({ ...row, content: await resolveContent(row) })),
      );

      // 화면에는 오래된 → 최신 순으로 표시.
      return { messages: messages.reverse(), nextCursor };
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
