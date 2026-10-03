import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { LOCATION_PROVISION_RETENTION_MS, recordLocationProvision } from "./location-provision";

const DAY = 24 * 60 * 60 * 1000;

describe("위치 제공 사실 기록", () => {
  let a: string;
  let b: string;

  beforeEach(async () => {
    a = (await prisma.user.create({ data: { email: `prov-a-${randomUUID()}@example.com` } })).id;
    b = (await prisma.user.create({ data: { email: `prov-b-${randomUUID()}@example.com` } })).id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [a, b] } } });
  });

  it("같은 시간대의 같은 종류는 한 행에 모아 횟수와 처음·마지막 시각을 남긴다", async () => {
    const t = (min: number) => new Date(Date.UTC(2026, 9, 4, 10, min));
    await recordLocationProvision(a, b, "live", t(5));
    await recordLocationProvision(a, b, "live", t(40));
    await recordLocationProvision(a, b, "live", t(20));
    await recordLocationProvision(a, b, "live", new Date(Date.UTC(2026, 9, 4, 11, 1)));

    const rows = await prisma.locationProvision.findMany({
      where: { subjectId: a },
      orderBy: { hourStart: "asc" },
    });
    expect(rows.map((r) => [r.hourStart.toISOString(), r.count])).toEqual([
      ["2026-10-04T10:00:00.000Z", 3],
      ["2026-10-04T11:00:00.000Z", 1],
    ]);
    expect(rows[0].firstAt).toEqual(t(5));
    expect(rows[0].lastAt).toEqual(t(40));
  });

  it("동시에 기록해도 한 행에 모두 센다", async () => {
    const now = new Date();
    await Promise.all(
      Array.from({ length: 10 }, () => recordLocationProvision(a, b, "latest", now)),
    );
    const rows = await prisma.locationProvision.findMany({ where: { subjectId: a } });
    expect(rows.map((r) => r.count)).toEqual([10]);
  });

  it("6개월 넘게 보관하고, 보관 기간이 지난 기록은 다음 기록 때 지운다", async () => {
    expect(LOCATION_PROVISION_RETENTION_MS).toBeGreaterThanOrEqual(183 * DAY);
    const now = new Date();
    await recordLocationProvision(a, b, "live", new Date(now.getTime() - 190 * DAY));
    await recordLocationProvision(a, b, "live", new Date(now.getTime() - 170 * DAY));
    await recordLocationProvision(a, b, "arrival", now);

    const kept = await prisma.locationProvision.findMany({ where: { subjectId: a } });
    expect(kept).toHaveLength(2);
  });

  describe("30일마다 모아 알림", () => {
    const noticeAt = async () =>
      (await prisma.user.findUniqueOrThrow({ where: { id: a } })).locationNoticeAt;

    it("동의 뒤 30일이 안 됐으면 알리지 않는다", async () => {
      const now = new Date();
      await prisma.user.update({
        where: { id: a },
        data: { locationConsentAt: new Date(now.getTime() - 29 * DAY) },
      });
      await recordLocationProvision(a, b, "live", now);
      expect(await noticeAt()).toBeNull();
    });

    it("30일이 지나면 다음 제공 때 한 번 알리고, 다음 30일까지는 다시 알리지 않는다", async () => {
      const now = new Date();
      await prisma.user.update({
        where: { id: a },
        data: { locationConsentAt: new Date(now.getTime() - 31 * DAY) },
      });
      await recordLocationProvision(a, b, "live", new Date(now.getTime() - 10 * DAY));
      expect(await noticeAt()).toBeNull();

      await recordLocationProvision(a, b, "latest", now);
      expect(await noticeAt()).toEqual(now);

      const later = new Date(now.getTime() + 5 * DAY);
      await recordLocationProvision(a, b, "live", later);
      expect(await noticeAt()).toEqual(now);
    });

    it("여러 제공이 겹쳐도 알림은 한 번만 차례를 잡는다", async () => {
      const now = new Date();
      await prisma.user.update({
        where: { id: a },
        data: { locationConsentAt: new Date(now.getTime() - 40 * DAY) },
      });
      const stamps = Array.from({ length: 5 }, (_, i) => new Date(now.getTime() + i));
      await Promise.all(stamps.map((t) => recordLocationProvision(a, b, "derived", t)));
      // 차례를 잡은 한 요청의 시각만 남는다(나머지는 조건부 갱신에 실패).
      const at = await noticeAt();
      expect(stamps.map((t) => t.getTime())).toContain(at?.getTime());
    });

    it("공유를 다시 켜 새로 동의하면 그때부터 30일을 센다", async () => {
      const now = new Date();
      await prisma.user.update({
        where: { id: a },
        data: {
          locationNoticeAt: new Date(now.getTime() - 60 * DAY),
          locationConsentAt: new Date(now.getTime() - 2 * DAY),
        },
      });
      await recordLocationProvision(a, b, "live", now);
      expect((await noticeAt())?.getTime()).toBe(now.getTime() - 60 * DAY);
    });
  });
});
