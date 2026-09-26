import { TRPCError } from "@trpc/server";
import { translator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { retryAfterMs, type Check } from "@/server/rate-limit";

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

/**
 * 입력 하나를 "틀릴 수도 있는 시도"로 먼저 기록해 둔다. 같은 사용자·IP의 입력은
 * advisory lock으로 줄을 세워, 한도 확인과 기록 사이에 다른 입력이 끼어들지 못한다
 * — 확인만 하고 틀린 뒤에 기록하던 때는 동시에 보낸 입력이 모두 "0번 틀림"을 읽고
 * 통과했다. 코드가 맞아 연결되면(또는 추측이 아닌 이유로 거절되면) release()로
 * 기록을 되돌려 실패로 세지 않는다.
 */
export async function reserveInviteCodeAttempt(
  userId: string,
  ip: string | null | undefined,
  locale?: string | null,
  now = new Date(),
) {
  const checks = inviteChecks(userId, ip);
  const { wait, ids } = await prisma.$transaction(async (tx) => {
    for (const { bucket, subject } of checks) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rate:${bucket}:${subject}`}))`;
    }
    const wait = await retryAfterMs(checks, now, tx);
    if (wait > 0) return { wait, ids: [] as string[] };
    const ids: string[] = [];
    for (const { bucket, subject, limits } of checks) {
      const hit = await tx.rateLimitHit.create({
        data: { bucket, subject, createdAt: now },
        select: { id: true },
      });
      ids.push(hit.id);
      const longest = Math.max(...limits.map((l) => l.windowMs));
      await tx.rateLimitHit.deleteMany({
        where: { bucket, createdAt: { lt: new Date(now.getTime() - longest) } },
      });
    }
    return { wait: 0, ids };
  });

  if (wait > 0) {
    const minutes = Math.max(1, Math.ceil(wait / 60_000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: translator(locale)("errors.inviteRateLimited", { minutes }),
    });
  }
  return {
    release: async () => {
      await prisma.rateLimitHit.deleteMany({ where: { id: { in: ids } } });
    },
  };
}
