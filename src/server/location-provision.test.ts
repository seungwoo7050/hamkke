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
});
