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
    baseUrl: "http://localhost:3000",
  });
}

describe("geofence 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-geofence-a-${randomUUID()}@example.com` },
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
    await prisma.geofence.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("생성/조회/삭제가 정상 동작한다", async () => {
    const caller = await callerFor(userAId);

    const created = await caller.geofence.create({ label: "집", lat: 37.5, lng: 127.0 });
    expect(created.label).toBe("집");
    expect(created.radiusM).toBe(200);

    const list = await caller.geofence.list();
    expect(list).toHaveLength(1);

    await caller.geofence.delete({ id: created.id });
    expect(await caller.geofence.list()).toHaveLength(0);
  });

  it("다른 사람의 지오펜스는 삭제할 수 없다", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-geofence-b-${randomUUID()}@example.com`, spaceId },
    });
    try {
      const callerA = await callerFor(userAId);
      const callerOutsider = await callerFor(outsider.id);

      const fence = await callerA.geofence.create({ label: "공항", lat: 37.5, lng: 127.0 });
      await callerOutsider.geofence.delete({ id: fence.id });

      expect(await callerA.geofence.list()).toHaveLength(1);
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
