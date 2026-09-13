import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";

// 초대코드 입력 rate limiting(ARCHITECTURE.md §7). 실패한 입력만 세고, 한도에
// 걸리면 올바른 코드여도 거절한다 — 맞는 코드를 찾아내는 것 자체를 막는 게
// 목적이라. IP 한도는 매직링크로 계정을 여럿 만들어 사용자 한도를 우회하는
// 경우를 막는다.
export const INVITE_CODE_LIMITS = {
  user: { max: 5, windowMs: 15 * 60_000 },
  ip: { max: 20, windowMs: 60 * 60_000 },
} as const;

const RETENTION_MS = 24 * 60 * 60_000;

type Scope = { userId: string } | { ip: string };

/** 한도에 걸렸으면 언제 풀리는지(ms), 아니면 null. */
async function blockedUntil(where: Scope, limit: { max: number; windowMs: number }, now: Date) {
  const since = new Date(now.getTime() - limit.windowMs);
  const recent = await prisma.inviteCodeAttempt.findMany({
    where: { ...where, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (recent.length < limit.max) return null;
  // 가장 오래된 실패들이 창 밖으로 빠져 한도 아래로 내려가는 시각.
  return recent[recent.length - limit.max].createdAt.getTime() + limit.windowMs;
}

export async function assertCanRedeemInviteCode(
  userId: string,
  ip: string | null | undefined,
  now = new Date(),
) {
  const [byUser, byIp] = await Promise.all([
    blockedUntil({ userId }, INVITE_CODE_LIMITS.user, now),
    ip ? blockedUntil({ ip }, INVITE_CODE_LIMITS.ip, now) : null,
  ]);
  const until = Math.max(byUser ?? 0, byIp ?? 0);
  if (until > now.getTime()) {
    const minutes = Math.max(1, Math.ceil((until - now.getTime()) / 60_000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `여러 번 틀려서 잠시 막아뒀어요. ${minutes}분 뒤에 다시 입력해 주세요.`,
    });
  }
}

export async function recordFailedInviteCodeAttempt(
  userId: string,
  ip: string | null | undefined,
  now = new Date(),
) {
  await prisma.$transaction([
    prisma.inviteCodeAttempt.create({ data: { userId, ip: ip ?? null, createdAt: now } }),
    // 하루 지난 기록은 어떤 한도에도 쓰이지 않는다 — 입력 때마다 정리.
    prisma.inviteCodeAttempt.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
    }),
  ]);
}
