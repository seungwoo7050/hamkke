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
async function callerFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createCaller({
    session: {
      user: { id: user.id, spaceId: user.spaceId, name: null, email: null, image: null },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    baseUrl: "http://localhost:3000",
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
});
