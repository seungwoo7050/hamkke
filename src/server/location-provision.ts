import "server-only";
import { randomUUID } from "node:crypto";
import type { LocationProvisionKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 확인자료 보관 기간(위치정보법 §16②: 6개월 이상). 반년을 넉넉히 넘겨 둔다. */
export const LOCATION_PROVISION_RETENTION_MS = 186 * DAY;

/**
 * 위치 주인(subject)의 위치나 위치에서 나온 정보가 받는 사람(recipient)에게 간 사실을
 * 자동으로 남긴다. 같은 시간대(정시 기준 한 시간)의 같은 종류는 한 행으로 묶어 횟수와
 * 마지막 시각만 올린다 - 동시 요청도 한 행에 모이게 ON CONFLICT로 한 번에 쓴다.
 * 보관 기간이 지난 그 사람의 기록은 쓸 때 정리한다(스케줄러 없이).
 */
export async function recordLocationProvision(
  subjectId: string,
  recipientId: string,
  kind: LocationProvisionKind,
  now = new Date(),
) {
  const hourStart = new Date(Math.floor(now.getTime() / HOUR) * HOUR);
  await prisma.$executeRaw`
    INSERT INTO "LocationProvision" ("id", "subjectId", "recipientId", "kind", "hourStart", "firstAt", "lastAt", "count")
    VALUES (${randomUUID()}, ${subjectId}, ${recipientId}, ${kind}::"LocationProvisionKind", ${hourStart}, ${now}, ${now}, 1)
    ON CONFLICT ("subjectId", "recipientId", "kind", "hourStart")
    DO UPDATE SET "count" = "LocationProvision"."count" + 1,
                  "lastAt" = GREATEST("LocationProvision"."lastAt", EXCLUDED."lastAt")`;
  await prisma.locationProvision.deleteMany({
    where: {
      subjectId,
      hourStart: { lt: new Date(now.getTime() - LOCATION_PROVISION_RETENTION_MS) },
    },
  });
}

/** 동의 철회(공유 끄기) 때 그 사람의 확인자료를 지운다(위치기반서비스 이용약관 5절). */
export function deleteLocationProvisions(subjectId: string) {
  return prisma.locationProvision.deleteMany({ where: { subjectId } });
}
