import "server-only";
import { TRPCError } from "@trpc/server";
import { translator } from "@/i18n/server";
import { type Db, isPremiumSpace, STORAGE_LIMIT_BYTES } from "@/lib/plan";
import { prisma } from "@/lib/prisma";

const GB = 1024 * 1024 * 1024;

/** 스페이스가 R2에 올려 둔 첨부 파일(메시지 이미지·음성 + 사진)의 바이트 — 사진만 따로도. */
export async function storageUsage(spaceId: string, db: Db = prisma) {
  const [messages, moments] = await Promise.all([
    db.message.aggregate({ where: { spaceId }, _sum: { mediaSize: true } }),
    db.moment.aggregate({ where: { spaceId }, _sum: { mediaSize: true } }),
  ]);
  const photos = moments._sum.mediaSize ?? 0;
  return { total: (messages._sum.mediaSize ?? 0) + photos, photos };
}

export async function storageUsedBytes(spaceId: string, db: Db = prisma) {
  return (await storageUsage(spaceId, db)).total;
}

// 스페이스별 총 저장 용량 상한(무료·프리미엄 모두). 업로드 주소 발급(신고한
// 크기)과 등록(실제 크기) 두 곳에서 본다 — 사진 개수 한도와 같은 이유.
export async function assertStorageAvailable(
  spaceId: string,
  addBytes: number,
  locale: string | null | undefined,
  db: Db = prisma,
) {
  const premium = await isPremiumSpace(spaceId, db);
  const limit = premium ? STORAGE_LIMIT_BYTES.premium : STORAGE_LIMIT_BYTES.free;
  const { total, photos } = await storageUsage(spaceId, db);
  if (total + addBytes <= limit) return;

  // 안내는 실제로 할 수 있는 일만 말한다. 지울 수 있는 것은 기억 탭의 사진뿐이고
  // 대화로 주고받은 사진·음성은 지울 수 없어서, 사진이 없으면 "사진을 지우라"는
  // 따를 수 없는 안내가 된다.
  const t = translator(locale);
  const args = { gb: limit / GB, premiumGb: STORAGE_LIMIT_BYTES.premium / GB };
  const key = premium
    ? photos > 0
      ? "storageLimitPremiumPhotos"
      : "storageLimitPremium"
    : photos > 0
      ? "storageLimitFreePhotos"
      : "storageLimitFree";
  throw new TRPCError({ code: "FORBIDDEN", message: t(`errors.${key}`, args) });
}
