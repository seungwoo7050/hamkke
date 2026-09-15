import { getRequestConfig } from "next-intl/server";
import { MESSAGES } from "./messages";
import { getRequestLocale } from "./request-locale";

// 요청마다 화면 언어를 정한다(ARCHITECTURE.md §12 — 언어별 URL 없음).
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return { locale, messages: MESSAGES[locale] };
});
