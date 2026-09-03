import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { FREE_TIER_LIMITS, isPremiumSpace } from "@/lib/plan";
import { createDownloadUrl, createUploadUrl } from "@/lib/r2";
import { router, spaceProcedure } from "../init";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const momentRouter = router({
  // R2에 직접 업로드할 presigned PUT URL 발급 — chat.createImageUploadUrl과
  // 동일한 패턴(서버는 파일 바이트를 거치지 않는다). 무료 티어는 사진 개수를
  // 제한한다(PRD.md §3.5 "무제한 사진/영상 저장"이 프리미엄 혜택) — 업로드
  // 자체를 여기서 막아야 "업로드는 됐는데 저장은 안 됨" 혼란이 없다.
  createUploadUrl: spaceProcedure
    .input(z.object({ contentType: z.enum(ALLOWED_IMAGE_TYPES) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isPremiumSpace(ctx.space.id))) {
        const count = await prisma.moment.count({ where: { spaceId: ctx.space.id } });
        if (count >= FREE_TIER_LIMITS.moments) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `무료 티어는 사진을 ${FREE_TIER_LIMITS.moments}장까지만 저장할 수 있어요. 프리미엄으로 무제한 저장해보세요.`,
          });
        }
      }

      const key = `moments/${ctx.space.id}/${randomUUID()}`;
      const uploadUrl = await createUploadUrl(key, input.contentType);
      return { uploadUrl, key };
    }),

  create: spaceProcedure
    .input(z.object({ key: z.string().min(1), caption: z.string().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const moment = await prisma.moment.create({
        data: {
          spaceId: ctx.space.id,
          uploaderId: ctx.session.user.id,
          mediaUrl: input.key,
          caption: input.caption,
        },
      });
      return { ...moment, mediaUrl: await createDownloadUrl(moment.mediaUrl) };
    }),

  list: spaceProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await prisma.moment.findMany({
        where: { spaceId: ctx.space.id },
        // createdAt이 같은 밀리초에 여러 개 생성되면 커서 페이지네이션이
        // 불안정해지므로 id(cuid, 생성 순 오름차순)를 tie-breaker로 둔다.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      // take(limit+1)개를 가져와 초과분이 있으면 그건 버리고, "마지막으로
      // 반환하는 항목"의 id를 다음 cursor로 쓴다. 초과분(아직 안 보여준
      // 다음 페이지의 첫 항목)의 id를 cursor로 쓰면 skip:1이 그 항목 자체를
      // 건너뛰어버려서 페이지마다 1개씩 유실된다.
      let nextCursor: string | undefined;
      if (rows.length > input.limit) {
        rows.pop();
        nextCursor = rows[rows.length - 1]?.id;
      }

      const moments = await Promise.all(
        rows.map(async (row) => ({ ...row, mediaUrl: await createDownloadUrl(row.mediaUrl) })),
      );

      return { moments, nextCursor };
    }),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.moment.deleteMany({ where: { id: input.id, spaceId: ctx.space.id } });
    return { ok: true };
  }),
});
