import { generateKeyPairSync, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { reportPaidInvoice, reportRefund, toMicros } from "./play-reporting";

// Play 개발자 API와 Google 토큰 서버는 가짜 fetch로 대신한다. 서비스 계정 키는 테스트용
// RSA 키라 JWT 서명까지 실제로 거친다.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

type Call = { url: string; body: unknown };
let calls: Call[];
let playStatus: number;

function invoice(overrides: Partial<Record<string, unknown>> = {}, playToken?: string) {
  return {
    id: `in_test_${randomUUID()}`,
    total: 4900,
    total_taxes: [{ amount: 445 }],
    currency: "krw",
    status_transitions: { paid_at: 1_791_000_000 },
    customer_address: null,
    parent: {
      subscription_details: {
        subscription: subscriptionId,
        metadata: playToken ? { spaceId: "s", playToken } : { spaceId: "s" },
      },
    },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

let subscriptionId: string;

beforeEach(() => {
  subscriptionId = `sub_test_${randomUUID()}`;
  calls = [];
  playStatus = 200;
  vi.stubEnv("GOOGLE_PLAY_PACKAGE_NAME", "com.hamkke.app");
  vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL", "play@hamkke.iam.gserviceaccount.com");
  vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY", PEM.replace(/\n/g, "\\n"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        const assertion = new URLSearchParams(init.body as string).get("assertion")!;
        expect(assertion.split(".")).toHaveLength(3);
        return Response.json({ access_token: "play-access", expires_in: 3600 });
      }
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer play-access");
      calls.push({ url, body: JSON.parse(init.body as string) });
      return new Response("{}", { status: playStatus });
    }),
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await prisma.playExternalTransaction.deleteMany({
    where: { stripeSubscriptionId: subscriptionId },
  });
});

describe("Play 거래 보고(한국 대체 결제)", () => {
  it("금액은 Play의 백만분의 1 단위로 바꾼다(원은 소수점이 없다)", () => {
    expect(toMicros(4455, "KRW")).toBe("4455000000");
    expect(toMicros(499, "USD")).toBe("4990000");
  });

  it("웹에서 시작한 구독(토큰 없음)은 보고하지 않는다", async () => {
    await reportPaidInvoice(invoice());
    expect(calls).toEqual([]);
  });

  it("첫 청구서는 앱이 받은 토큰으로, 갱신 청구서는 첫 거래 ID로 보고한다", async () => {
    const first = invoice({}, "tok-123");
    await reportPaidInvoice(first);
    const renewal = invoice({ status_transitions: { paid_at: 1_793_600_000 } }, "tok-123");
    await reportPaidInvoice(renewal);

    expect(calls[0].url).toBe(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.hamkke.app/externalTransactions?externalTransactionId=${first.id}`,
    );
    expect(calls[0].body).toEqual({
      originalPreTaxAmount: { priceMicros: "4455000000", currency: "KRW" },
      originalTaxAmount: { priceMicros: "445000000", currency: "KRW" },
      transactionTime: new Date(1_791_000_000 * 1000).toISOString(),
      recurringTransaction: {
        externalTransactionToken: "tok-123",
        externalSubscription: { subscriptionType: "RECURRING" },
      },
      userTaxAddress: { regionCode: "KR" },
    });
    expect(calls[1].body).toMatchObject({
      recurringTransaction: { initialExternalTransactionId: first.id },
    });
    expect(calls[1].body).not.toHaveProperty("recurringTransaction.externalTransactionToken");
  });

  it("같은 청구서는 두 번 보고하지 않고, Play가 이미 받았다고 하면(409) 성공으로 본다", async () => {
    const paid = invoice({}, "tok-1");
    playStatus = 409;
    await reportPaidInvoice(paid);
    await reportPaidInvoice(paid);
    expect(calls).toHaveLength(1);
    expect(await prisma.playExternalTransaction.count({ where: { id: paid.id } })).toBe(1);
  });

  it("보고에 실패하면 던진다(웹훅이 500을 돌려 Stripe가 다시 보낸다)", async () => {
    playStatus = 500;
    await expect(reportPaidInvoice(invoice({}, "tok-1"))).rejects.toThrow(/Play 거래 보고 실패/);
    expect(
      await prisma.playExternalTransaction.count({
        where: { stripeSubscriptionId: subscriptionId },
      }),
    ).toBe(0);
  });

  it("설정(GOOGLE_PLAY_*)이 없으면 앱 결제를 조용히 넘기지 않는다", async () => {
    vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY", "");
    await expect(reportPaidInvoice(invoice({}, "tok-1"))).rejects.toThrow(/GOOGLE_PLAY/);
  });

  it("환불은 처음 전액이면 fullRefund, 일부면 세전 비율로 나눈 partialRefund로 보고한다", async () => {
    const paid = invoice({}, "tok-1");
    await reportPaidInvoice(paid);
    vi.spyOn(stripe.invoicePayments, "list").mockResolvedValue({
      data: [{ invoice: paid.id }],
    } as never);
    const charge = (amountRefunded: number) =>
      ({ id: "ch_1", payment_intent: "pi_1", amount_refunded: amountRefunded }) as Stripe.Charge;

    await reportRefund(charge(1000));
    expect(calls[1].url).toMatch(new RegExp(`externalTransactions/${paid.id}:refund$`));
    expect(calls[1].body).toMatchObject({
      partialRefund: {
        refundId: "ch_1-1000",
        // 1000원 중 세전 몫: 1000 × 4455/4900 ≈ 909원
        refundPreTaxAmount: { priceMicros: "909000000", currency: "KRW" },
      },
    });

    // 같은 환불 이벤트가 다시 와도 보고하지 않는다.
    await reportRefund(charge(1000));
    expect(calls).toHaveLength(2);

    await reportRefund(charge(4900));
    expect(calls[2].body).toMatchObject({
      partialRefund: { refundId: "ch_1-4900", refundPreTaxAmount: { priceMicros: "3546000000" } },
    });
  });

  it("한 번에 전액 환불하면 fullRefund", async () => {
    const paid = invoice({}, "tok-1");
    await reportPaidInvoice(paid);
    vi.spyOn(stripe.invoicePayments, "list").mockResolvedValue({
      data: [{ invoice: paid.id }],
    } as never);
    await reportRefund({
      id: "ch_2",
      payment_intent: "pi_2",
      amount_refunded: 4900,
    } as Stripe.Charge);
    expect(calls[1].body).toEqual({ refundTime: expect.any(String), fullRefund: {} });
  });
});
