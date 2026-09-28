import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { type Locale } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/request-locale";
import { getBaseUrl, getClientIp } from "@/lib/base-url";

export type TRPCContext = {
  session: Session | null;
  baseUrl: string;
  /** 초대코드 rate limiting용(ARCHITECTURE.md §7). 테스트 caller는 생략 가능. */
  ip?: string | null;
  /** 요청자의 언어 - 에러 문구 등. 테스트 caller는 생략 가능(한국어). */
  locale?: Locale;
};

export async function createTRPCContext(): Promise<TRPCContext> {
  // next/headers는 요청 컨텍스트 밖(Vitest 등)에서 호출하면 에러를 던져서,
  // 라우터가 직접 부르지 않고 여기서 한 번 계산해 넘긴다 - 테스트에서는
  // caller를 만들 때 baseUrl을 원하는 값으로 그냥 채워 넣으면 된다.
  const [session, baseUrl, ip, locale] = await Promise.all([
    auth(),
    getBaseUrl(),
    getClientIp(),
    getRequestLocale(),
  ]);
  return { session, baseUrl, ip, locale };
}
