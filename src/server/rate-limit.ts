import "server-only";
import { TRPCError } from "@trpc/server";
import { translator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";

// 요청 횟수 제한(ARCHITECTURE.md §7) - 기록은 Postgres(RateLimitHit). 2인 전용
// 앱이라 트래픽이 작아 Redis 없이 DB로 충분하다. 창은 "최근 windowMs 동안 max회"인
// 슬라이딩 창이고, 한 bucket에 창을 여럿(예: 분당·하루) 걸 수 있다.
export type Limit = { max: number; windowMs: number };
export type Check = { bucket: string; subject: string; limits: readonly Limit[] };

type Db = Pick<typeof prisma, "rateLimitHit">;

async function waitMs(db: Db, check: Check, limit: Limit, now: Date) {
  const since = new Date(now.getTime() - limit.windowMs);
  const where = { bucket: check.bucket, subject: check.subject, createdAt: { gte: since } };
  const count = await db.rateLimitHit.count({ where });
  if (count < limit.max) return 0;
  // 창 안의 기록 중 오래된 것부터 빠져 한도 아래로 내려가는 시각.
  const pivot = await db.rateLimitHit.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    skip: count - limit.max,
    select: { createdAt: true },
  });
  return pivot ? pivot.createdAt.getTime() + limit.windowMs - now.getTime() : 0;
}

/** 걸린 한도가 풀릴 때까지 남은 ms(0이면 통과). 기록하지 않는다. */
export async function retryAfterMs(checks: readonly Check[], now = new Date(), db: Db = prisma) {
  let wait = 0;
  for (const check of checks) {
    for (const limit of check.limits) {
      wait = Math.max(wait, await waitMs(db, check, limit, now));
    }
  }
  return wait;
}

/** 한 번 쓴 것으로 기록하고, 그 bucket의 가장 긴 창보다 오래된 기록은 정리한다. */
export async function recordHits(checks: readonly Check[], now = new Date(), db: Db = prisma) {
  for (const check of checks) {
    await db.rateLimitHit.create({
      data: { bucket: check.bucket, subject: check.subject, createdAt: now },
    });
    const longest = Math.max(...check.limits.map((l) => l.windowMs));
    await db.rateLimitHit.deleteMany({
      where: { bucket: check.bucket, createdAt: { lt: new Date(now.getTime() - longest) } },
    });
  }
}

/**
 * 확인하고 통과하면 바로 기록한다(남은 ms, 0이면 통과해서 기록됨). 같은
 * bucket·subject의 동시 요청은 advisory lock으로 직렬화해 한도를 넘겨 새지 않는다.
 */
export async function consume(checks: readonly Check[], now = new Date()) {
  return prisma.$transaction(async (tx) => {
    for (const { bucket, subject } of checks) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rate:${bucket}:${subject}`}))`;
    }
    const wait = await retryAfterMs(checks, now, tx);
    if (wait === 0) await recordHits(checks, now, tx);
    return wait;
  });
}

/**
 * tRPC 절차용 - 한도 안이면 기록하고 통과, 넘으면 남은 시간을 담은
 * TOO_MANY_REQUESTS를 요청자 언어로 던진다.
 */
export async function consumeOrThrow(checks: readonly Check[], locale?: string | null) {
  const wait = await consume(checks);
  if (wait === 0) return;
  const t = translator(locale);
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message:
      wait < 60_000
        ? t("errors.rateLimitedSeconds", { seconds: Math.max(1, Math.ceil(wait / 1000)) })
        : t("errors.rateLimitedMinutes", { minutes: Math.ceil(wait / 60_000) }),
  });
}
