import "server-only";
import { prisma } from "@/lib/prisma";

// 무료 티어 한도(PRD.md §3.5). 정확한 숫자는 상품 정책에 없어 합리적
// 기본값으로 정했다 — 가격 정책이 바뀌면 이 상수만 조정하면 된다.
export const FREE_TIER_LIMITS = {
  moments: 30,
  meetupPins: 20,
  activeCapsules: 3,
} as const;

export async function isPremiumSpace(spaceId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { spaceId } });
  return subscription?.status === "active";
}
