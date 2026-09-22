import { afterEach, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, jwtVerify, decodeProtectedHeader } from "jose";
import { isPrivateRealtimeEnabled, signRealtimeToken } from "./realtime-token";

const original = process.env.SUPABASE_JWT_PRIVATE_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.SUPABASE_JWT_PRIVATE_KEY;
  else process.env.SUPABASE_JWT_PRIVATE_KEY = original;
});

describe("Realtime 토큰", () => {
  it("키가 없으면 null — 공개 채널로 동작하는 전환 전 상태", async () => {
    delete process.env.SUPABASE_JWT_PRIVATE_KEY;
    expect(isPrivateRealtimeEnabled()).toBe(false);
    expect(await signRealtimeToken("user-1", "space-1")).toBeNull();
  });

  it("스페이스 ID를 담아 ES256으로 서명하고, 가져온 공개 키로 검증된다", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    process.env.SUPABASE_JWT_PRIVATE_KEY = JSON.stringify({
      ...(await exportJWK(privateKey)),
      kid: "test-kid",
    });
    expect(isPrivateRealtimeEnabled()).toBe(true);

    const now = new Date("2026-09-30T00:00:00Z");
    const issued = await signRealtimeToken("user-1", "space-1", now);
    expect(issued).not.toBeNull();
    expect(decodeProtectedHeader(issued!.token)).toMatchObject({ alg: "ES256", kid: "test-kid" });

    const { payload } = await jwtVerify(issued!.token, publicKey, {
      audience: "authenticated",
      currentDate: new Date(now.getTime() + 30 * 60_000),
    });
    expect(payload).toMatchObject({ role: "authenticated", space_id: "space-1", sub: "user-1" });
    expect(issued!.expiresAt).toBe(now.getTime() + 60 * 60_000);

    // 한 시간이 지나면 만료
    await expect(
      jwtVerify(issued!.token, publicKey, { currentDate: new Date(now.getTime() + 61 * 60_000) }),
    ).rejects.toThrow();
  });
});
