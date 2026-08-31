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

describe("calendar 라우터 (통합)", () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-calendar-a-${randomUUID()}@example.com` },
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
    await prisma.calendarEvent.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("생성/조회가 시작시각 오름차순으로 정상 동작한다", async () => {
    const caller = await callerFor(userAId);

    await caller.calendar.create({
      title: "생일 파티",
      startAt: "2026-06-01T10:00:00Z",
      endAt: "2026-06-01T12:00:00Z",
      timezone: "Asia/Seoul",
    });
    await caller.calendar.create({
      title: "영상통화",
      startAt: "2026-01-10T09:00:00Z",
      endAt: "2026-01-10T09:30:00Z",
      timezone: "Asia/Seoul",
    });

    const list = await caller.calendar.list();
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe("영상통화");
    expect(list[1].title).toBe("생일 파티");
  });

  it("종료 시각이 시작 시각보다 빠르면 거부된다", async () => {
    const caller = await callerFor(userAId);
    await expect(
      caller.calendar.create({
        title: "잘못된 일정",
        startAt: "2026-06-01T12:00:00Z",
        endAt: "2026-06-01T10:00:00Z",
        timezone: "Asia/Seoul",
      }),
    ).rejects.toThrow();
  });

  it("삭제하면 목록에서 사라진다", async () => {
    const caller = await callerFor(userAId);
    const event = await caller.calendar.create({
      title: "삭제 예정",
      startAt: "2026-03-01T00:00:00Z",
      endAt: "2026-03-01T01:00:00Z",
      timezone: "Asia/Seoul",
    });

    await caller.calendar.delete({ id: event.id });
    expect(await caller.calendar.list()).toHaveLength(0);
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-calendar-b-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(
        caller.calendar.create({
          title: "몰래",
          startAt: "2026-01-01T00:00:00Z",
          endAt: "2026-01-01T01:00:00Z",
          timezone: "Asia/Seoul",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
