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

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      spaceId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      plan: "premium",
      status: subscription.status,
      currentPeriodEnd,
    },
    update: {
      status: subscription.status,
      currentPeriodEnd,
    },
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
