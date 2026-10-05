// 외부 서비스 키가 실제로 있는지. 키가 없는 곳(CI, 처음 받은 개발 환경)에서는
// setup.ts가 자리표시자 값을 채워 import 때 터지는 모듈(Stripe 클라이언트 등)을
// 막는다 - 자리표시자도 "키 없음"으로 보고, 그 서비스에 실제로 왕복하는 테스트를
// describe.skipIf / it.skipIf로 건너뛴다.
export const PLACEHOLDER = "placeholder";

function present(...names: string[]) {
  return names.every((name) => {
    const value = process.env[name];
    return !!value && !value.includes(PLACEHOLDER);
  });
}

export const hasR2 = present(
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
);
export const hasStripe = present("STRIPE_SECRET_KEY", "STRIPE_PREMIUM_PRICE_ID");
export const hasRealtime = present(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
);
