import { DEFAULT_LOCALE, isLocale, matchAcceptLanguage, type Locale } from "./config";

/**
 * 언어 결정 순서(PRD §3.8): 내가 고른 언어 → 기기 언어(Accept-Language) → 한국어.
 * 순수 함수라 화면(src/i18n/request.ts)과 tRPC 컨텍스트가 같은 규칙을 쓴다.
 */
export function pickLocale({
  userLocale,
  acceptLanguage,
}: {
  userLocale?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(userLocale)) return userLocale;
  return matchAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
