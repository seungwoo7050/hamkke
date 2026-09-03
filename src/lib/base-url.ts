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
