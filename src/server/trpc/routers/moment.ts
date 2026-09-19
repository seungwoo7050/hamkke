import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { FREE_TIER_LIMITS, isPremiumSpace } from "@/lib/plan";
import { createDownloadUrl, createUploadUrl } from "@/lib/r2";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { verifyUpload } from "@/server/uploads";
import { router, spaceProcedure } from "../init";
import { translator } from "@/i18n/server";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

// 무료 티어 사진 개수 한도. 업로드 주소 발급과 등록 두 곳에서 본다 — 발급 때만
// 보면 주소만 여러 개 받아 두고 나중에 한꺼번에 등록하는 식으로 넘길 수 있다.
async function assertMomentQuota(spaceId: string, locale: string | null | undefined) {
  if (await isPremiumSpace(spaceId)) return;
  const count = await prisma.moment.count({ where: { spaceId } });
  if (count >= FREE_TIER_LIMITS.moments) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: translator(locale)("errors.momentLimit", { limit: FREE_TIER_LIMITS.moments }),
    });
  }
}

export const momentRouter = router({
  // R2에 직접 업로드할 presigned PUT URL 발급 — chat.createImageUploadUrl과
  // 동일한 패턴(서버는 파일 바이트를 거치지 않는다). 무료 티어는 사진 개수를
  // 제한한다(PRD.md §3.5 "무제한 사진/영상 저장"이 프리미엄 혜택) — 업로드
  // 자체를 여기서 막아야 "업로드는 됐는데 저장은 안 됨" 혼란이 없다.
  createUploadUrl: spaceProcedure
    .input(
      z.object({
        contentType: z.enum(ALLOWED_IMAGE_TYPES),
        size: z.number().int().positive().max(MAX_UPLOAD_BYTES.image),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMomentQuota(ctx.space.id, ctx.locale);

      const key = `moments/${ctx.space.id}/${randomUUID()}`;
      const uploadUrl = await createUploadUrl(key, input.contentType, input.size);
      return { uploadUrl, key };
    }),

  create: spaceProcedure
    .input(z.object({ key: z.string().min(1), caption: z.string().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertMomentQuota(ctx.space.id, ctx.locale);
      await verifyUpload(input.key, {
        folder: "moments",
        spaceId: ctx.space.id,
        allowedTypes: ALLOWED_IMAGE_TYPES,
        locale: ctx.locale,
      });

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
