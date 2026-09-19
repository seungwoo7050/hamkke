import "server-only";
import { TRPCError } from "@trpc/server";
import { translator } from "@/i18n/server";
import { isPremiumSpace, STORAGE_LIMIT_BYTES } from "@/lib/plan";
import { prisma } from "@/lib/prisma";

const GB = 1024 * 1024 * 1024;

/** 스페이스가 R2에 올려 둔 첨부 파일(메시지 이미지·음성 + 사진)의 총 바이트. */
export async function storageUsedBytes(spaceId: string) {
  const [messages, moments] = await Promise.all([
    prisma.message.aggregate({ where: { spaceId }, _sum: { mediaSize: true } }),
    prisma.moment.aggregate({ where: { spaceId }, _sum: { mediaSize: true } }),
  ]);
  return (messages._sum.mediaSize ?? 0) + (moments._sum.mediaSize ?? 0);
}

// 스페이스별 총 저장 용량 상한(무료·프리미엄 모두). 업로드 주소 발급(신고한
// 크기)과 등록(실제 크기) 두 곳에서 본다 — 사진 개수 한도와 같은 이유.
export async function assertStorageAvailable(
  spaceId: string,
  addBytes: number,
  locale: string | null | undefined,
) {
  const premium = await isPremiumSpace(spaceId);
  const limit = premium ? STORAGE_LIMIT_BYTES.premium : STORAGE_LIMIT_BYTES.free;
  if ((await storageUsedBytes(spaceId)) + addBytes <= limit) return;

  const t = translator(locale);
  throw new TRPCError({
    code: "FORBIDDEN",
    message: premium
      ? t("errors.storageLimitPremium", { gb: limit / GB })
      : t("errors.storageLimitFree", { gb: limit / GB }),
  });
}
