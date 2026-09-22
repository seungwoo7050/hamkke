import "server-only";
import { headers } from "next/headers";

// Stripe Checkout/Portal의 success_url·return_url을 만들 때 쓴다. 별도
// env 없이 요청 헤더에서 그대로 읽어 로컬(localhost)과 배포 환경 모두
// 자동으로 맞는 절대 URL을 만든다.
export async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host")!;
  const protocol = host.startsWith("localhost") ? "http" : "https";
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
