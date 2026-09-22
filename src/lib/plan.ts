import "server-only";
import { prisma } from "@/lib/prisma";

// 무료 티어 한도(PRD.md §3.5). 정확한 숫자는 상품 정책에 없어 합리적
// 기본값으로 정했다 — 가격 정책이 바뀌면 이 상수만 조정하면 된다.
export const FREE_TIER_LIMITS = {
  moments: 30,
  meetupPins: 20,
  activeCapsules: 3,
} as const;

// 스페이스별 첨부 파일 총 저장 용량(바이트). 프리미엄도 상한을 둔다 — 한 스페이스가
// 저장소를 개인 클라우드처럼 쓰는 것을 막기 위해서라 넉넉하게 잡았다.
export const STORAGE_LIMIT_BYTES = {
  free: 1 * 1024 * 1024 * 1024,
  premium: 20 * 1024 * 1024 * 1024,
} as const;

export async function isPremiumSpace(spaceId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { spaceId } });
  return subscription?.status === "active";
}
