import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { reportPaidInvoice, reportRefund } from "@/server/play-reporting";

/**
 * 한 스페이스에 활성 구독이 둘 생겼을 때(Checkout 쪽 방지를 뚫고 들어온 경우의
 * 마지막 안전망). DB가 활성이라고 알고 있는 구독을 Stripe에서 다시 확인해, 정말
 * 활성이면 새로 들어온 중복 구독을 즉시 해지하고 결제를 환불한다. 기존 구독이
 * 사실은 이미 끝났다면(그 이벤트가 아직 안 온 것) 새 구독으로 갈아타도록 true.
 * 웹훅 재시도에도 두 번 환불하지 않게 멱등 키를 쓴다.
 */
async function resolveDuplicate(keptId: string, duplicate: Stripe.Subscription) {
  // 조회 실패는 삼키지 않는다 - 네트워크 오류로 갈아타면 이중 청구가 조용히
  // 남는다. 던지면 500이 나고 Stripe가 웹훅을 다시 보낸다.
  const kept = await stripe.subscriptions.retrieve(keptId).catch((err: unknown) => {
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") return null;
    throw err;
  });
  if (kept?.status !== "active") return true;

  const current = await stripe.subscriptions.retrieve(duplicate.id);
  if (current.status !== "canceled") {
    await stripe.subscriptions.cancel(duplicate.id, undefined, {
      idempotencyKey: `cancel-duplicate-${duplicate.id}`,
    });
  }

  const invoiceId =
    typeof duplicate.latest_invoice === "string"
      ? duplicate.latest_invoice
      : duplicate.latest_invoice?.id;
  if (invoiceId) {
    const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid" });
    for (const { payment } of payments.data) {
      const paymentIntent =
        typeof payment.payment_intent === "string"
          ? payment.payment_intent
          : payment.payment_intent?.id;
      if (!paymentIntent) continue;
      // 멱등 키는 24시간만 유효하니, 그 뒤의 재시도에서 "이미 환불됨"은 성공으로 본다.
      await stripe.refunds
        .create(
          {
            payment_intent: paymentIntent,
            reason: "duplicate",
            metadata: { keptSubscription: keptId },
          },
          { idempotencyKey: `refund-duplicate-${duplicate.id}-${paymentIntent}` },
        )
        .catch((err: unknown) => {
          if (err instanceof Stripe.errors.StripeError && err.code === "charge_already_refunded")
            return;
          throw err;
        });
    }
  }

  console.warn(
    `[billing] canceled and refunded duplicate subscription ${duplicate.id} (kept ${keptId})`,
  );
  return false;
}

// customer.subscription.*(created/updated/deleted) 하나로 생성·갱신·취소를
// 전부 upsert한다(인자는 이벤트 본문이 아니라 Stripe에서 다시 읽은 구독) - Stripe가 체크아웃 완료 시에도 subscription.created를
// 함께 보내주므로 checkout.session.completed를 따로 처리할 필요가 없다.
async function syncSubscription(subscription: Stripe.Subscription) {
  const spaceId = subscription.metadata.spaceId;
  if (!spaceId) return;

  // Stripe API가 current_period_end를 Subscription 최상위에서 각
  // SubscriptionItem으로 옮겼다(SDK 타입 기준, 2026-09 확인).
  const currentPeriodEnd = new Date(subscription.items.data[0].current_period_end * 1000);
  const stripeCustomerId = subscription.customer as string;

  // 스페이스당 Subscription은 한 행(spaceId @unique)이라 구독 ID가 아니라
  // spaceId로 찾는다 - 해지 후 재구독하면 Stripe가 새 구독 ID를 주므로, 구독
  // ID로 upsert하면 같은 spaceId로 새 행을 만들려다 unique 충돌이 났다(결제는
  // 됐는데 프리미엄이 안 켜짐).
  const existing = await prisma.subscription.findUnique({ where: { spaceId } });

  // 다른 구독의 이벤트인데 지금 행이 활성이면 덮지 않는다 - 지난 구독의 늦게
  // 도착한 이벤트(예: 이전 구독 deleted)가 새 활성 구독을 무효로 만들면 안 된다.
  // 둘 다 활성이면 중복 결제라 새로 들어온 쪽을 해지·환불한다.
  if (
    existing &&
    existing.stripeSubscriptionId !== subscription.id &&
    existing.status === "active"
  ) {
    if (subscription.status !== "active") return;
    const replaced = await resolveDuplicate(existing.stripeSubscriptionId, subscription);
    if (!replaced) return;
  }

  const data = {
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd,
  };
  await prisma.subscription.upsert({
    where: { spaceId },
    create: { spaceId, plan: "premium", ...data },
    update: data,
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    // 웹훅은 순서를 보장하지 않는다 - 해지 뒤에 그 전의 updated(active)가 재전송으로
    // 늦게 도착하면 본문을 그대로 쓰는 순간 해지된 구독이 되살아난다. 본문은 "이
    // 구독이 바뀌었다"는 신호로만 쓰고 지금 상태를 Stripe에서 다시 읽는다. 조회
    // 실패는 500으로 돌려 Stripe가 다시 보내게 한다.
    const current = await stripe.subscriptions.retrieve(event.data.object.id);
    await syncSubscription(current);
  }

  // Play 앱에서 시작한 구독의 결제·환불은 Play 개발자 API에 보고한다(한국 대체 결제).
  // 웹에서 시작한 구독은 그 안에서 걸러진다. 실패는 500 → Stripe가 다시 보낸다.
  if (event.type === "invoice.paid") await reportPaidInvoice(event.data.object);
  if (event.type === "charge.refunded") await reportRefund(event.data.object);

  return NextResponse.json({ received: true });
}
