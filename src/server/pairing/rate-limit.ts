import { TRPCError } from "@trpc/server";
import { translator } from "@/i18n/server";
import { recordHits, retryAfterMs, type Check } from "@/server/rate-limit";

// 초대코드 입력 rate limiting(ARCHITECTURE.md §7). 실패한 입력만 세고, 한도에
// 걸리면 올바른 코드여도 거절한다 — 맞는 코드를 찾아내는 것 자체를 막는 게
// 목적이라. IP 한도는 매직링크로 계정을 여럿 만들어 사용자 한도를 우회하는
// 경우를 막는다.
export const INVITE_CODE_LIMITS = {
  user: { max: 5, windowMs: 15 * 60_000 },
  ip: { max: 20, windowMs: 60 * 60_000 },
} as const;

function inviteChecks(userId: string, ip: string | null | undefined): Check[] {
  return [
    { bucket: "invite.fail.user", subject: userId, limits: [INVITE_CODE_LIMITS.user] },
    ...(ip ? [{ bucket: "invite.fail.ip", subject: ip, limits: [INVITE_CODE_LIMITS.ip] }] : []),
  ];
}

export async function assertCanRedeemInviteCode(
  userId: string,
  ip: string | null | undefined,
  locale?: string | null,
  now = new Date(),
) {
  const wait = await retryAfterMs(inviteChecks(userId, ip), now);
  if (wait > 0) {
    const minutes = Math.max(1, Math.ceil(wait / 60_000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: translator(locale)("errors.inviteRateLimited", { minutes }),
    });
  }
}

export async function recordFailedInviteCodeAttempt(
  userId: string,
  ip: string | null | undefined,
  now = new Date(),
) {
  await recordHits(inviteChecks(userId, ip), now);
}
