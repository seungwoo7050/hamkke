import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCallerFactory } from "../init";
import { appRouter } from "./_app";

const createCaller = createCallerFactory(appRouter);

async function callerFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createCaller({
    session: {
      user: { id: user.id, spaceId: user.spaceId, name: null, email: null, image: null },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
}

describe("meetup 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-meetup-a-${randomUUID()}@example.com` },
    });
    userAId = a.id;

    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    spaceId = space.id;
    await prisma.user.update({ where: { id: userAId }, data: { spaceId } });
  });

  afterEach(async () => {
    await prisma.meetupPin.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("생성/조회가 날짜 내림차순으로 정상 동작한다", async () => {
    const caller = await callerFor(userAId);

    await caller.meetup.create({
      label: "첫 만남 카페",
      lat: 37.5,
      lng: 127.0,
      date: "2026-01-01",
    });
    await caller.meetup.create({
      label: "공항",
      lat: 37.4,
      lng: 126.5,
      date: "2026-06-01",
    });

    const list = await caller.meetup.list();
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe("공항");
    expect(list[1].label).toBe("첫 만남 카페");
  });

  it("삭제하면 목록에서 사라진다", async () => {
    const caller = await callerFor(userAId);
    const pin = await caller.meetup.create({
      label: "바다",
      lat: 35.1,
      lng: 129.0,
      date: "2026-03-01",
    });

    await caller.meetup.delete({ id: pin.id });
    expect(await caller.meetup.list()).toHaveLength(0);
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-meetup-b-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(
        caller.meetup.create({ label: "몰래", lat: 0, lng: 0, date: "2026-01-01" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
