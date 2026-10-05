import { scrubEvent } from "./sentry-scrub";

// 서버·엣지·브라우저가 함께 쓰는 Sentry 설정. DSN이 없으면(개발·CI) SDK를 켜지
// 않는다 - 아무것도 보내지 않는다. DSN은 브라우저 번들에 들어가도 되는 공개 값이다.
export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn: sentryDsn,
  enabled: !!sentryDsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // 오류만 모은다 - 성능 추적·세션 리플레이는 쓰지 않는다(개인정보·요금).
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
};
