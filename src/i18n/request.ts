import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "./config";
import { MESSAGES } from "./messages";

// 요청마다 화면 언어를 정한다(ARCHITECTURE.md §12 — 언어별 URL 없음).
export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return { locale, messages: MESSAGES[locale] };
});
