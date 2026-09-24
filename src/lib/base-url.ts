import "server-only";
import { headers } from "next/headers";

// Stripe Checkout/Portal의 success_url·return_url을 만들 때 쓴다.
export async function getBaseUrl() {
  return baseUrlFrom(await headers(), process.env);
}

// 운영은 APP_URL로 고정한다 — 요청의 Host 헤더는 보내는 쪽이 정할 수 있어서, 그대로
// 쓰면 결제 후 돌아올 주소를 남의 도메인으로 바꿀 수 있다. 없으면(로컬 개발) 요청에서
// 만든다. 프로토콜은 프록시가 알려 준 값을 먼저 보고, 없으면 개발 서버는 http다
// ("localhost로 시작하면 http"였을 땐 에뮬레이터의 10.0.2.2:3000이 https가 됐다).
export function baseUrlFrom(h: Headers, env: { APP_URL?: string; NODE_ENV?: string }) {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const protocol = h.get("x-forwarded-proto") ?? (env.NODE_ENV === "production" ? "https" : "http");
  return `${protocol}://${host}`;
}

// 요청한 쪽 IP — Vercel(과 대부분의 프록시)이 넣는 x-forwarded-for의 첫 값.
// 로컬 개발처럼 헤더가 없으면 null(그땐 사용자 단위 제한만 걸린다).
export async function getClientIp() {
  return clientIpFrom(await headers());
}

export function clientIpFrom(h: Headers) {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || null;
}
