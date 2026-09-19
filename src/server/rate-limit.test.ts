// 실제 로컬 DB(RateLimitHit)에 왕복한다.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { consume, recordHits, retryAfterMs, type Check } from "./rate-limit";

const bucket = `test.${randomUUID()}`;

afterEach(async () => {
  await prisma.rateLimitHit.deleteMany({ where: { bucket } });
});

function check(limits: Check["limits"], subject = "s1"): Check[] {
  return [{ bucket, subject, limits }];
}

describe("rate-limit", () => {
  it("창 안에서 max회까지 통과하고, 넘으면 가장 오래된 기록이 빠질 때까지 기다리게 한다", async () => {
    const limits = [{ max: 3, windowMs: 60_000 }];
    const t0 = new Date("2026-09-30T00:00:00Z");
    for (let i = 0; i < 3; i++) {
      expect(await consume(check(limits), new Date(t0.getTime() + i * 1000))).toBe(0);
    }
    // 4번째(3초 시점): 첫 기록(0초)이 60초에 빠지므로 57초 남음.
    expect(await consume(check(limits), new Date(t0.getTime() + 3000))).toBe(57_000);
    // 막힌 요청은 기록되지 않는다.
    expect(await prisma.rateLimitHit.count({ where: { bucket } })).toBe(3);
    // 61초 뒤엔 다시 통과.
    expect(await consume(check(limits), new Date(t0.getTime() + 61_000))).toBe(0);
  });

  it("동시에 몰려도 max회보다 더 통과시키지 않는다", async () => {
    const limits = [{ max: 5, windowMs: 60_000 }];
    const results = await Promise.all(Array.from({ length: 12 }, () => consume(check(limits))));
    expect(results.filter((w) => w === 0)).toHaveLength(5);
  });

  it("창을 여럿 걸면 가장 오래 기다려야 하는 창을 따른다", async () => {
    const limits = [
      { max: 100, windowMs: 60_000 },
      { max: 2, windowMs: 24 * 60 * 60_000 },
    ];
    const t0 = new Date("2026-09-30T00:00:00Z");
    await consume(check(limits), t0);
    await consume(check(limits), new Date(t0.getTime() + 1000));
    const wait = await consume(check(limits), new Date(t0.getTime() + 2000));
    expect(wait).toBe(24 * 60 * 60_000 - 2000);
  });

  it("subject가 다르면 따로 센다", async () => {
    const limits = [{ max: 1, windowMs: 60_000 }];
    expect(await consume(check(limits, "a"))).toBe(0);
    expect(await consume(check(limits, "b"))).toBe(0);
    expect(await retryAfterMs(check(limits, "a"))).toBeGreaterThan(0);
  });

  it("기록할 때 그 bucket의 가장 긴 창보다 오래된 기록을 정리한다", async () => {
    const limits = [{ max: 10, windowMs: 60_000 }];
    const now = new Date();
    await prisma.rateLimitHit.create({
      data: { bucket, subject: "old", createdAt: new Date(now.getTime() - 61_000) },
    });
    await recordHits(check(limits), now);
    expect(await prisma.rateLimitHit.count({ where: { bucket, subject: "old" } })).toBe(0);
  });
});
