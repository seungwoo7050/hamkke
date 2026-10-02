import "server-only";
import { randomUUID } from "node:crypto";
import type { LocationProvisionKind } from "@/generated/prisma/client";
import { translator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 제공 내역을 모아 알리는 주기(위치정보법 §19④·시행령: 최대 30일). */
export const LOCATION_NOTICE_PERIOD_MS = 30 * DAY;

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
                  "firstAt" = LEAST("LocationProvision"."firstAt", EXCLUDED."firstAt"),
                  "lastAt" = GREATEST("LocationProvision"."lastAt", EXCLUDED."lastAt")`;
  await prisma.locationProvision.deleteMany({
    where: {
      subjectId,
      hourStart: { lt: new Date(now.getTime() - LOCATION_PROVISION_RETENTION_MS) },
    },
  });
  await noticeIfDue(subjectId, now);
}

/** 기간 안에 위치가 간 상대별 횟수(설정 시트의 내역 줄과 30일 알림이 함께 쓴다). */
export async function provisionSummary(subjectId: string, since: Date, until = new Date()) {
  const rows = await prisma.locationProvision.groupBy({
    by: ["recipientId"],
    where: { subjectId, lastAt: { gte: since }, firstAt: { lte: until } },
    _sum: { count: true },
  });
  return rows.map((r) => ({ recipientId: r.recipientId, count: r._sum.count ?? 0 }));
}

/**
 * 동의한 뒤(또는 마지막 알림 뒤) 30일이 지났으면 그동안의 제공 내역을 위치 주인에게
 * 한 번에 알린다(위치정보법 §19③④ - 동의를 받아 모아서 통보). 스케줄러가 없어 다음
 * 제공을 기록할 때 판단한다 - 위치가 가지 않는 동안엔 알릴 내역도 없다. 두 요청이 겹쳐도
 * 한 번만 보내도록 마지막 알림 시각을 조건부로 바꿔 차례를 잡는다.
 */
async function noticeIfDue(subjectId: string, now: Date) {
  const user = await prisma.user.findUnique({
    where: { id: subjectId },
    select: { locationConsentAt: true, locationNoticeAt: true, locale: true, deviceLocale: true },
  });
  if (!user?.locationConsentAt) return;
  const { locationConsentAt: consentAt, locationNoticeAt: noticeAt } = user;
  const since = noticeAt && noticeAt > consentAt ? noticeAt : consentAt;
  if (now.getTime() - since.getTime() < LOCATION_NOTICE_PERIOD_MS) return;

  const { count: claimed } = await prisma.user.updateMany({
    where: { id: subjectId, locationNoticeAt: noticeAt },
    data: { locationNoticeAt: now },
  });
  if (claimed === 0) return;

  const summary = await provisionSummary(subjectId, since, now);
  const total = summary.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return;
  const recipients = await prisma.user.findMany({
    where: { id: { in: summary.map((r) => r.recipientId) } },
    select: { name: true },
  });
  const t = translator(user.locale ?? user.deviceLocale);
  const name = recipients.map((r) => r.name?.trim() || t("push.partnerFallback")).join(", ");
  const days = Math.round((now.getTime() - since.getTime()) / DAY);
  // 알림 실패(토큰 없음 등)로 기록을 막지 않는다. 같은 내역은 설정 시트에서도 보인다.
  await sendPushToUser(subjectId, {
    title: "Hamkke",
    body: t("push.locationNotice", { name, count: total, days }),
  }).catch((err: unknown) => console.error("위치 제공 내역 알림 실패", err));
}

/** 동의 철회(공유 끄기) 때 그 사람의 확인자료를 지운다(위치기반서비스 이용약관 5절). */
export function deleteLocationProvisions(subjectId: string) {
  return prisma.locationProvision.deleteMany({ where: { subjectId } });
}
