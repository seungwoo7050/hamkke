import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

export function register() {
  // Node·엣지 런타임이 각각 이 함수를 부른다. 같은 설정으로 초기화한다.
  Sentry.init(sentryOptions);
}

// 서버 컴포넌트·라우트 핸들러·서버 액션에서 잡히지 않은 오류. tRPC는 자기 안에서
// 오류를 잡아 응답으로 바꾸므로 여기로 오지 않는다 - src/app/api/trpc 라우트의 onError.
export const onRequestError = Sentry.captureRequestError;
