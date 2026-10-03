import "server-only";
import { createSign } from "node:crypto";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// 한국 대체 결제(Google Play "alternative billing only")의 서버 쪽 의무: Play 앱에서
// 시작한 결제를 Play 개발자 API(externalTransactions)에 보고한다. 앱은 결제 전에 받은
// 거래 토큰을 Checkout 세션·구독 metadata(playToken)에 실어 두었다(billing 라우터).
// 웹에서 시작한 구독은 Play 밖의 거래라 보고하지 않는다.
//
// - 첫 청구서: recurringTransaction.externalTransactionToken(앱이 받은 토큰)
// - 갱신 청구서: recurringTransaction.initialExternalTransactionId(첫 청구서 ID)
// - 환불: externalTransactions/{id}:refund(전액 또는 일부)
// externalTransactionId는 Stripe 청구서 ID를 쓴다(우리가 정하는 고유 ID).
// 참고: developer.android.com/google/play/billing/outside-gpb-backend (2026-10-04 확인)

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

// Stripe 금액은 소수점 없는 통화(원 등)면 그 단위, 아니면 1/100 단위다. Play는 백만분의 1.
const ZERO_DECIMAL = new Set(["krw", "jpy", "vnd", "clp", "pyg", "ugx", "xaf", "xof"]);

export function toMicros(amount: number, currency: string) {
  const unit = ZERO_DECIMAL.has(currency.toLowerCase()) ? BigInt(1_000_000) : BigInt(10_000);
  return (BigInt(Math.round(amount)) * unit).toString();
}

function config() {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  const clientEmail = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!packageName || !clientEmail || !privateKey) {
    // 앱 결제가 들어왔는데 보고할 수 없으면 조용히 넘기지 않는다 - 웹훅이 500으로
    // 실패해 Stripe가 다시 보내고, 그동안 환경변수를 채우면 된다(24시간 안).
    throw new Error("Play 거래 보고 설정(GOOGLE_PLAY_*)이 없어요");
  }
  return { packageName, clientEmail, privateKey };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

// 서비스 계정 JWT(RS256)를 Google OAuth 토큰으로 바꾼다. 한 시간짜리라 만료 1분 전까지 재사용.
async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const { clientEmail, privateKey } = config();
  const now = Math.floor(Date.now() / 1000);
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: clientEmail,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google 토큰 발급 실패: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function callPlay(path: string, body: object) {
  const res = await fetch(`${API}/${config().packageName}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  // 이미 보고한 거래(재시도)는 성공으로 본다.
  if (res.status === 409) return;
  if (!res.ok) throw new Error(`Play 거래 보고 실패: ${res.status} ${await res.text()}`);
}

function subscriptionOf(invoice: Stripe.Invoice) {
  const details = invoice.parent?.subscription_details;
  if (!details) return null;
  const id =
    typeof details.subscription === "string" ? details.subscription : details.subscription.id;
  return { id, playToken: details.metadata?.playToken };
}

/**
 * 결제된 청구서 하나를 보고한다(invoice.paid 웹훅). 앱에서 시작한 구독이 아니거나, 금액이
 * 0이거나, 이미 보고했으면 아무것도 하지 않는다. 실패는 던진다 - 웹훅이 500을 돌려
 * Stripe가 다시 보낸다(Play는 결제 뒤 24시간 안의 보고를 요구한다).
 */
export async function reportPaidInvoice(invoice: Stripe.Invoice) {
  const subscription = subscriptionOf(invoice);
  if (!subscription?.playToken || invoice.total <= 0) return;
  if (await prisma.playExternalTransaction.findUnique({ where: { id: invoice.id } })) return;

  const first = await prisma.playExternalTransaction.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    orderBy: { reportedAt: "asc" },
  });
  const tax = (invoice.total_taxes ?? []).reduce((sum, t) => sum + t.amount, 0);
  const preTax = invoice.total - tax;
  const currency = invoice.currency.toUpperCase();
  const paidAt = invoice.status_transitions.paid_at ?? Math.floor(Date.now() / 1000);

  await callPlay(`externalTransactions?externalTransactionId=${encodeURIComponent(invoice.id)}`, {
    originalPreTaxAmount: { priceMicros: toMicros(preTax, currency), currency },
    originalTaxAmount: { priceMicros: toMicros(tax, currency), currency },
    transactionTime: new Date(paidAt * 1000).toISOString(),
    recurringTransaction: {
      ...(first
        ? { initialExternalTransactionId: first.id }
        : { externalTransactionToken: subscription.playToken }),
      externalSubscription: { subscriptionType: "RECURRING" },
    },
    // 한국 대체 결제 프로그램의 거래다. Stripe가 주소를 받았다면 그 나라를 쓴다.
    userTaxAddress: { regionCode: invoice.customer_address?.country ?? "KR" },
  });

  await prisma.playExternalTransaction.create({
    data: {
      id: invoice.id,
      stripeSubscriptionId: subscription.id,
      initialTransactionId: first?.id ?? invoice.id,
      currency,
      totalAmount: invoice.total,
      preTaxAmount: preTax,
    },
  });
}

/**
 * 환불을 보고한다(charge.refunded 웹훅). 그 결제의 청구서가 Play에 보고된 거래일 때만.
 * 전액이면 fullRefund, 일부면 이번 환불의 세전 금액(청구서의 세전 비율로 나눔)을 보낸다.
 */
export async function reportRefund(charge: Stripe.Charge) {
  const paymentIntent =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return;
  const payments = await stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: paymentIntent },
  });
  const invoiceId = payments.data
    .map((p) => (typeof p.invoice === "string" ? p.invoice : p.invoice?.id))
    .find(Boolean);
  if (!invoiceId) return;
  const reported = await prisma.playExternalTransaction.findUnique({ where: { id: invoiceId } });
  if (!reported || charge.amount_refunded <= reported.refundedAmount) return;

  const refundTime = new Date().toISOString();
  const full = charge.amount_refunded >= reported.totalAmount;
  const thisRefund = charge.amount_refunded - reported.refundedAmount;
  await callPlay(`externalTransactions/${encodeURIComponent(invoiceId)}:refund`, {
    refundTime,
    ...(full && reported.refundedAmount === 0
      ? { fullRefund: {} }
      : {
          partialRefund: {
            refundId: `${charge.id}-${charge.amount_refunded}`,
            refundPreTaxAmount: {
              priceMicros: toMicros(
                Math.round((thisRefund * reported.preTaxAmount) / reported.totalAmount),
                reported.currency,
              ),
              currency: reported.currency,
            },
          },
        }),
  });
  await prisma.playExternalTransaction.update({
    where: { id: invoiceId },
    data: { refundedAmount: charge.amount_refunded },
  });
}
