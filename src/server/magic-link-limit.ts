import "server-only";
import { clientIpFrom } from "@/lib/base-url";
import { consume, type Check } from "@/server/rate-limit";

export { clientIpFrom };

// 매직링크(로그인 메일) 발송 횟수 제한. 임의 주소로 메일을 계속 보내게 하면
// Resend 한도가 바닥나(진짜 사용자가 로그인 못 함) 초과 요금이 나오고, 스팸
// 신고로 발신 도메인 평판이 떨어진다. 이메일 한도는 한 사람에게 쏟아지는 것을,
// IP 한도는 한 곳에서 여러 주소로 뿌리는 것을 막는다.
export const MAGIC_LINK_LIMITS = {
  email: { max: 3, windowMs: 15 * 60_000 },
  ip: { max: 10, windowMs: 60 * 60_000 },
} as const;

/** Auth.js 기본 정규화와 같게(소문자·공백 제거·도메인의 쉼표 뒤 버림). */
export function normalizeEmail(email: string) {
  const [local, domain = ""] = email.toLowerCase().trim().split("@");
  return `${local}@${domain.split(",")[0]}`;
}

export function magicLinkChecks(email: string, ip: string | null): Check[] {
  return [
    {
      bucket: "magic-link.email",
      subject: normalizeEmail(email),
      limits: [MAGIC_LINK_LIMITS.email],
    },
    ...(ip ? [{ bucket: "magic-link.ip", subject: ip, limits: [MAGIC_LINK_LIMITS.ip] }] : []),
  ];
}

/**
 * 한도를 통과한 요청만 send로 넘긴다. 로그인 화면을 거치지 않고 Auth.js
 * 엔드포인트로 바로 보내는 요청까지 막으려고 발송 직전(sendVerificationRequest)에 건다.
 */
export async function sendMagicLinkWithinLimit<P extends { identifier: string; request: Request }>(
  params: P,
  send: (params: P) => PromiseLike<void> | void,
) {
  const wait = await consume(
    magicLinkChecks(params.identifier, clientIpFrom(params.request.headers)),
  );
  if (wait > 0) throw new Error("magic link rate limited");
  await send(params);
}
