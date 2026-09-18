import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { MESSAGES } from "./messages";
import { PSEUDO_COOKIE, pseudoMessages } from "./pseudo";
import { getRequestLocale } from "./request-locale";

// 요청마다 화면 언어를 정한다(ARCHITECTURE.md §12 — 언어별 URL 없음).
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  // 개발 전용 가짜 언어 — 하드코딩 문장·잘리는 레이아웃 점검(src/i18n/pseudo.ts).
  if (process.env.NODE_ENV !== "production" && (await cookies()).get(PSEUDO_COOKIE)) {
    return { locale: "en", messages: pseudoMessages(MESSAGES.en) };
  }
  return { locale, messages: MESSAGES[locale] };
});
