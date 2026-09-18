import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// customer.subscription.*(created/updated/deleted) 하나로 생성·갱신·취소를
// 전부 upsert한다 — Stripe가 체크아웃 완료 시에도 subscription.created를
// 함께 보내주므로 checkout.session.completed를 따로 처리할 필요가 없다.
async function syncSubscription(subscription: Stripe.Subscription) {
  const spaceId = subscription.metadata.spaceId;
  if (!spaceId) return;

  // Stripe API가 current_period_end를 Subscription 최상위에서 각
  // SubscriptionItem으로 옮겼다(SDK 타입 기준, 2026-09 확인).
  const currentPeriodEnd = new Date(subscription.items.data[0].current_period_end * 1000);
  const stripeCustomerId = subscription.customer as string;

  // 스페이스당 Subscription은 한 행(spaceId @unique)이라 구독 ID가 아니라
  // spaceId로 찾는다 — 해지 후 재구독하면 Stripe가 새 구독 ID를 주므로, 구독
  // ID로 upsert하면 같은 spaceId로 새 행을 만들려다 unique 충돌이 났다(결제는
  // 됐는데 프리미엄이 안 켜짐).
  const existing = await prisma.subscription.findUnique({ where: { spaceId } });

  // 다른 구독의 이벤트인데 지금 행이 활성이면 덮지 않는다 — 지난 구독의 늦게
  // 도착한 이벤트(예: 이전 구독 deleted)가 새 활성 구독을 무효로 만들면 안 된다.
  // 둘 다 활성인 중복 구독은 여기서 덮지 않고 따로 정리한다.
  if (
    existing &&
    existing.stripeSubscriptionId !== subscription.id &&
    existing.status === "active"
  ) {
    return;
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
    await syncSubscription(event.data.object);
  }

  return NextResponse.json({ received: true });
}
