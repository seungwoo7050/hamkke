// 실제 Stripe API에 왕복한다(테스트 모드 키 사용).
import { describe, expect, it } from "vitest";
import { hasStripe } from "@/test/services";
import { stripe } from "./stripe";

describe.skipIf(!hasStripe)("stripe 클라이언트", () => {
  it("설정된 STRIPE_PREMIUM_PRICE_ID가 실제로 존재하고 구독형 가격이다", async () => {
    const price = await stripe.prices.retrieve(process.env.STRIPE_PREMIUM_PRICE_ID!);
    expect(price.active).toBe(true);
    expect(price.recurring).not.toBeNull();
    expect(price.recurring?.interval).toBe("month");
  });
});
