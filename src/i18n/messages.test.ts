import { createTranslator } from "use-intl/core";
import { describe, expect, it } from "vitest";
import { LOCALES, DEFAULT_LOCALE, matchAcceptLanguage } from "./config";
import { MESSAGES } from "./messages";

// 문구 파일 품질 게이트(ARCHITECTURE.md §12): 모든 언어가 기준(한국어)과 같은
// 키를 갖고, 빈 문구가 없고, ICU 문법이 깨지지 않았는지.
function leaves(obj: unknown, prefix = ""): [string, string][] {
  if (typeof obj === "string") return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

const base = leaves(MESSAGES[DEFAULT_LOCALE])
  .map(([k]) => k)
  .sort();

describe.each(LOCALES)("문구 파일 %s", (locale) => {
  const entries = leaves(MESSAGES[locale]);

  it("기준 언어와 키가 같다(빠진 것도 남는 것도 없음)", () => {
    expect(entries.map(([k]) => k).sort()).toEqual(base);
  });

  it("빈 문구가 없다", () => {
    expect(entries.filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it("ICU 문법이 깨지지 않았다", () => {
    const errors: string[] = [];
    const t = createTranslator({
      locale,
      messages: MESSAGES[locale],
      onError: (e) => errors.push(e.message),
    });
    for (const [key, value] of entries) {
      // 변수 자리엔 아무 값이나 넣어 문법만 본다.
      const args = Object.fromEntries([...value.matchAll(/\{(\w+)/g)].map(([, name]) => [name, 1]));
      (t as unknown as (k: string, a: object) => string)(key, args);
    }
    expect(errors.filter((e) => !e.includes("MISSING"))).toEqual([]);
  });
});

describe("Accept-Language", () => {
  it("지원하는 첫 언어, 지역 코드는 무시", () => {
    expect(matchAcceptLanguage("en-US,en;q=0.9,ko;q=0.8")).toBe("en");
    expect(matchAcceptLanguage("ja-JP,ko;q=0.5")).toBe("ko");
    expect(matchAcceptLanguage("fr-FR")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });
});
