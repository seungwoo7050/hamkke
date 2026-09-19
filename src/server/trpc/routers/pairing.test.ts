// 로컬 Postgres(docker compose up -d)가 떠 있어야 통과한다 — 실제 DB에 대고
// 트랜잭션/레이스 처리를 검증하는 통합 테스트라 목(mock)을 쓰지 않는다.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCallerFactory } from "../init";
import { appRouter } from "./_app";

const createCaller = createCallerFactory(appRouter);

// 실제 요청은 매번 auth()로 세션을 새로 읽으므로, 테스트도 캐시된 caller를
// 재사용하지 않고 호출 직전 DB에서 최신 spaceId를 읽어 caller를 새로 만든다.
async function callerFor(userId: string, ip: string | null = null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createCaller({
    session: {
      user: { id: user.id, spaceId: user.spaceId, name: null, email: null, image: null },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    baseUrl: "http://localhost:3000",
    ip,
  });
}

describe("pairing 플로우 (통합)", () => {
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `test-a-${randomUUID()}@example.com` } }),
      prisma.user.create({ data: { email: `test-b-${randomUUID()}@example.com` } }),
    ]);
    userAId = a.id;
    userBId = b.id;
  });

  afterEach(async () => {
    const users = await prisma.user.findMany({
      where: { id: { in: [userAId, userBId] } },
      select: { spaceId: true },
    });
    const spaceIds = users.map((u) => u.spaceId).filter((id): id is string => id !== null);

    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    if (spaceIds.length > 0) {
      await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    }
  });

  it("A가 코드를 생성하고 B가 입력하면 둘 다 active가 된다", async () => {
    const created = await (await callerFor(userAId)).pairing.createInviteCode();
    expect(created.inviteCode).toHaveLength(6);

    const redeemed = await (
      await callerFor(userBId)
    ).pairing.redeemInviteCode({ code: created.inviteCode });

    const statusA = await (await callerFor(userAId)).pairing.getStatus();
    expect(statusA).toEqual({ status: "active", spaceId: redeemed.spaceId });

    const statusB = await (await callerFor(userBId)).pairing.getStatus();
    expect(statusB).toEqual({ status: "active", spaceId: redeemed.spaceId });
  });

  it("존재하지 않는 코드는 NOT_FOUND", async () => {
    const caller = await callerFor(userAId);
    await expect(caller.pairing.redeemInviteCode({ code: "ZZZZZZ" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("자기 자신이 생성한 코드는 재입력할 수 없다", async () => {
    const created = await (await callerFor(userAId)).pairing.createInviteCode();

    await expect(
      (await callerFor(userAId)).pairing.redeemInviteCode({ code: created.inviteCode }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("만료된 코드는 PRECONDITION_FAILED", async () => {
    const created = await (await callerFor(userAId)).pairing.createInviteCode();

    const spaceOwner = await prisma.user.findUniqueOrThrow({ where: { id: userAId } });
    await prisma.space.update({
      where: { id: spaceOwner.spaceId! },
      data: { inviteCodeExpiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      (await callerFor(userBId)).pairing.redeemInviteCode({ code: created.inviteCode }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("이미 사용된(active) 코드는 세 번째 사용자가 다시 쓸 수 없다", async () => {
    const created = await (await callerFor(userAId)).pairing.createInviteCode();
    await (await callerFor(userBId)).pairing.redeemInviteCode({ code: created.inviteCode });

    const userC = await prisma.user.create({
      data: { email: `test-c-${randomUUID()}@example.com` },
    });
    try {
      await expect(
        (await callerFor(userC.id)).pairing.redeemInviteCode({ code: created.inviteCode }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    } finally {
      await prisma.user.delete({ where: { id: userC.id } });
    }
  });

  it("createInviteCode는 만료 전이면 같은 코드를 반환한다(멱등)", async () => {
    const first = await (await callerFor(userAId)).pairing.createInviteCode();
    const second = await (await callerFor(userAId)).pairing.createInviteCode();

    expect(second.inviteCode).toBe(first.inviteCode);
  });

  describe("입력 횟수 제한 (ARCHITECTURE.md §7)", () => {
    // 기록은 사용자와 cascade로 묶이지 않으니 테스트가 남긴 초대코드 기록을 지운다
    // (고정 IP가 반복 실행으로 쌓여 한도에 걸리지 않게).
    afterEach(async () => {
      await prisma.rateLimitHit.deleteMany({ where: { bucket: { startsWith: "invite." } } });
    });

    it("사용자당 15분에 5번 틀리면 올바른 코드도 막고, 남은 시간을 알려준다", async () => {
      const created = await (await callerFor(userAId)).pairing.createInviteCode();
      const b = await callerFor(userBId);
      for (let i = 0; i < 5; i++) {
        await expect(b.pairing.redeemInviteCode({ code: "ZZZZZZ" })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }

      const blocked = b.pairing.redeemInviteCode({ code: created.inviteCode });
      await expect(blocked).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
      await expect(blocked).rejects.toThrow(/1[45]분 뒤/);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userBId } })).spaceId).toBeNull();
    });

    it("창(15분)이 지난 실패는 세지 않는다", async () => {
      const created = await (await callerFor(userAId)).pairing.createInviteCode();
      const old = new Date(Date.now() - 16 * 60_000);
      await prisma.rateLimitHit.createMany({
        data: Array.from({ length: 5 }, () => ({
          bucket: "invite.fail.user",
          subject: userBId,
          createdAt: old,
        })),
      });

      const redeemed = await (
        await callerFor(userBId)
      ).pairing.redeemInviteCode({
        code: created.inviteCode,
      });
      expect(redeemed.spaceId).toBeTruthy();
    });

    it("같은 IP에서 1시간에 20번 틀리면 다른 계정이어도 막는다", async () => {
      const ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
      // 계정을 여럿 만들어 사용자 한도를 피해 간 경우 — 실패 20건이 이미 쌓였다.
      await prisma.rateLimitHit.createMany({
        data: Array.from({ length: 20 }, () => ({ bucket: "invite.fail.ip", subject: ip })),
      });

      await expect(
        (await callerFor(userBId, ip)).pairing.redeemInviteCode({ code: "ZZZZZZ" }),
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
      // 다른 IP의 같은 계정은 막지 않는다(사용자 한도엔 아직 여유).
      await expect(
        (await callerFor(userBId, "198.51.100.7")).pairing.redeemInviteCode({ code: "ZZZZZZ" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("이미 스페이스가 있어 거절된 입력은 실패로 세지 않는다", async () => {
      const created = await (await callerFor(userAId)).pairing.createInviteCode();
      await expect(
        (await callerFor(userAId)).pairing.redeemInviteCode({ code: created.inviteCode }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await prisma.rateLimitHit.count({ where: { subject: userAId } })).toBe(0);
    });
  });
});
