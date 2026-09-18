import { createTranslator } from "use-intl/core";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { MESSAGES } from "./messages";

/**
 * 요청 컨텍스트 밖(tRPC 에러·푸시 알림·테스트)에서 쓰는 번역기. 에러는 요청자의
 * 언어(ctx.locale), 푸시는 받는 사람의 언어(User.locale)로 만든다(ARCHITECTURE §12).
 */
export function translator(locale?: string | null) {
  const l: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return createTranslator({ locale: l, messages: MESSAGES[l] });
}
