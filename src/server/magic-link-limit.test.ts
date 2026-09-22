// 실제 로컬 DB(RateLimitHit)에 왕복한다. 메일은 가짜 send로 대신한다.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendMagicLinkWithinLimit } from "./magic-link-limit";

function params(identifier: string, ip: string) {
  return {
    identifier,
    request: new Request("http://localhost/api/auth/signin/resend", {
      headers: { "x-forwarded-for": ip },
    }),
  };
}

describe("매직링크 발송 횟수 제한", () => {
  afterEach(async () => {
    await prisma.rateLimitHit.deleteMany({ where: { bucket: { startsWith: "magic-link." } } });
  });

  it("같은 이메일은 15분에 3번까지만 보낸다(대소문자·공백이 달라도 같은 주소)", async () => {
    const send = vi.fn();
    const email = `a-${randomUUID()}@example.com`;
    for (let i = 0; i < 3; i++) {
      await sendMagicLinkWithinLimit(params(email, `198.51.100.${i}`), send);
    }
    await expect(
      sendMagicLinkWithinLimit(params(`  ${email.toUpperCase()} `, "198.51.100.9"), send),
    ).rejects.toThrow(/rate limited/);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("같은 IP는 여러 주소로 1시간에 10번까지만 보낸다", async () => {
    const send = vi.fn();
    const ip = "203.0.113.77";
    for (let i = 0; i < 10; i++) {
      await sendMagicLinkWithinLimit(params(`b${i}-${randomUUID()}@example.com`, ip), send);
    }
    await expect(
      sendMagicLinkWithinLimit(params(`c-${randomUUID()}@example.com`, ip), send),
    ).rejects.toThrow(/rate limited/);
    expect(send).toHaveBeenCalledTimes(10);
  });
});
