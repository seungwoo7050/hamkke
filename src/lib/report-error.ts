import * as Sentry from "@sentry/nextjs";

/**
 * 요청은 계속 진행해도 되지만 알아야 하는 실패(푸시 발송 등)를 남긴다. 로그에 한 줄,
 * Sentry가 켜져 있으면 이벤트로도 보낸다(src/lib/sentry-options.ts, 개인정보는
 * beforeSend에서 걸러짐).
 */
export function reportError(where: string) {
  return (error: unknown) => {
    console.warn(`[${where}]`, error);
    Sentry.captureException(error, { tags: { where } });
  };
}
