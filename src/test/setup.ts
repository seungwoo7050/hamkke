// Vitest는 Next.js와 달리 .env를 자동으로 읽지 않는다 - Prisma가 DATABASE_URL을
// 읽기 전에 직접 로드해줘야 한다.
import "dotenv/config";
import { PLACEHOLDER } from "./services";

// 키가 없으면 자리표시자를 채운다. 모듈을 불러올 때 바로 클라이언트를 만드는 곳
// (src/lib/stripe.ts 등)이 터지면 그 모듈을 거치는 라우터 테스트가 전부 실패한다.
// 실제로 서비스에 왕복하는 테스트는 src/test/services.ts의 hasXxx로 건너뛴다.
const placeholders: Record<string, string> = {
  STRIPE_SECRET_KEY: `sk_test_${PLACEHOLDER}`,
  STRIPE_WEBHOOK_SECRET: `whsec_${PLACEHOLDER}`,
  STRIPE_PREMIUM_PRICE_ID: `price_${PLACEHOLDER}`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${PLACEHOLDER}.invalid`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PLACEHOLDER,
  SUPABASE_SECRET_KEY: PLACEHOLDER,
  R2_ACCOUNT_ID: PLACEHOLDER,
  R2_ACCESS_KEY_ID: PLACEHOLDER,
  R2_SECRET_ACCESS_KEY: PLACEHOLDER,
  R2_BUCKET_NAME: PLACEHOLDER,
};
for (const [name, value] of Object.entries(placeholders)) {
  process.env[name] ||= value;
}
