import "server-only";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendPushToSpacePartner } from "@/lib/push";
import { deletePrefix } from "@/lib/r2";
import { stripe } from "@/lib/stripe";
import { normalizeEmail } from "@/server/magic-link-limit";
import { PENDING_PREFIX } from "@/server/uploads";

// 계정 삭제(Google Play 요건·개인정보 파기). 2026-09-30 결정: 한 사람이 탈퇴하면
// 스페이스를 통째로 지운다 — 대화·사진·기억은 두 사람이 함께 만든 것이라 한쪽만
// 남기지 않는다. 상대 계정은 남고 스페이스 없는 상태(다시 페어링 가능)가 된다.
//
// 순서가 중요하다: 돈이 나가는 구독 해지 → R2 파일 → DB. 앞 단계가 실패하면
// 던져서 멈추고(아무것도 지우지 않은 채 다시 시도 가능), 구독이 살아 있는 채로
// 데이터만 사라지는 일이 없게 한다.

/** 해지할 게 남은 구독 상태 — 이미 끝난 구독은 건드리지 않는다. */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);

async function cancelSubscription(spaceId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { spaceId } });
  if (!subscription || !LIVE_STATUSES.has(subscription.status)) return;
  try {
    // 즉시 해지 — 이후 청구가 멈춘다(남은 기간 환불은 하지 않는다).
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
  } catch (err) {
    // Stripe 쪽에 이미 없는 구독이면 해지할 것도 없다.
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") return;
    throw err;
  }
}

export async function deleteSpace(spaceId: string, deletedByUserId: string) {
  await cancelSubscription(spaceId);

  for (const folder of ["messages", "moments"]) {
    await deletePrefix(`${folder}/${spaceId}/`);
    await deletePrefix(`${PENDING_PREFIX}${folder}/${spaceId}/`);
  }

  // 상대에게는 지우기 전에 알린다(받는 사람 언어). 알림 실패로 삭제를 멈추지 않는다.
  await sendPushToSpacePartner(spaceId, deletedByUserId, (t) => ({
    title: "Hamkke",
    body: t("push.spaceDeleted"),
  })).catch(() => {});

  // 대화·사진·기억·구독 행은 Space에 연쇄 삭제로 묶여 있고, 상대의 spaceId는 비워진다.
  await prisma.space.delete({ where: { id: spaceId } });
}

export async function deleteAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, spaceId: true },
  });
  if (!user) return;

  if (user.spaceId) await deleteSpace(user.spaceId, user.id);

  // 요청 횟수 기록은 사용자와 관계로 묶여 있지 않아 따로 지운다(사용자 ID·이메일).
  await prisma.rateLimitHit.deleteMany({
    where: {
      subject: { in: [user.id, ...(user.email ? [normalizeEmail(user.email)] : [])] },
    },
  });
  // 로그인 계정·세션·푸시 토큰·위치 기록·지오펜스·비행은 User에 연쇄 삭제로 묶여 있다.
  await prisma.user.delete({ where: { id: user.id } });
}
