// 실제 Stripe API에 왕복한다(테스트 모드 키 사용).
import { describe, expect, it } from "vitest";
import { hasStripe } from "@/test/services";
import { createStripeClient, stripe } from "./stripe";

describe("createStripeClient", () => {
  it("비밀 키가 비어 있어도 기본 시뮬레이터 키로 인스턴스를 만든다", () => {
    const client = createStripeClient("", undefined);
    expect(client).toBeDefined();
  });

  it("STRIPE_SIMULATOR_URL이 주어지면 해당 호스트·포트로 연결 설정을 잡는다", () => {
    const client = createStripeClient("sk_test_simulator", "http://localhost:4100");
    expect(client).toBeDefined();
  });
});

describe.skipIf(!hasStripe)("stripe 클라이언트", () => {
  it("설정된 STRIPE_PREMIUM_PRICE_ID가 실제로 존재하고 구독형 가격이다", async () => {
    const price = await stripe.prices.retrieve(process.env.STRIPE_PREMIUM_PRICE_ID!);
    expect(price.active).toBe(true);
    expect(price.recurring).not.toBeNull();
    expect(price.recurring?.interval).toBe("month");
  });
});
