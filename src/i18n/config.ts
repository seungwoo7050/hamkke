// 지원 언어(ARCHITECTURE.md §12, PRD §3.8). 새 언어는 여기 한 줄 + messages/xx.json
// 하나(+ 필요하면 src/i18n/format.ts의 언어별 부품, globals.css의 :lang() 폰트
// 토큰)로 늘린다 — 컴포넌트는 바꾸지 않는다.
export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** 아무 단서도 없을 때 — 한국어가 기본 언어다. */
export const DEFAULT_LOCALE: Locale = "ko";

/** 언어 선택 UI에서는 각 언어를 그 언어로 쓴다(영어 화면에서도 "한국어"). */
export const LOCALE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Accept-Language("en-US,en;q=0.9,ko;q=0.8")에서 지원하는 첫 언어. 지역 코드는
 * 버리고 언어만 본다(en-GB도 en).
 */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((x) => x.lang).find(isLocale) ?? null;
}
