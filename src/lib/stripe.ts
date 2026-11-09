import "server-only";
import Stripe from "stripe";

// 키가 없는 환경(next build·새 워크트리)에서도 모듈 import 때 죽지 않도록 시뮬레이터용
// 기본 키를 두고, STRIPE_SIMULATOR_URL이 있으면 로컬 Stripe 시뮬레이터로 향하게 한다.
export function createStripeClient(
  secretKey = process.env.STRIPE_SECRET_KEY,
  simulatorUrl = process.env.STRIPE_SIMULATOR_URL,
) {
  const key = secretKey || "sk_test_simulator";
  if (!simulatorUrl) return new Stripe(key);
  const url = new URL(simulatorUrl);
  return new Stripe(key, {
    protocol: url.protocol === "https:" ? "https" : "http",
    host: url.hostname,
    port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
  });
}

export const stripe = createStripeClient();
