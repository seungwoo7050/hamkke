import { describe, expect, it } from "vitest";
import { pickLocale } from "./resolve";

describe("언어 결정(PRD §3.8)", () => {
  it("내가 고른 언어가 먼저", () => {
    expect(pickLocale({ userLocale: "en", acceptLanguage: "ko-KR" })).toBe("en");
  });
  it("고르지 않았으면 기기 언어", () => {
    expect(pickLocale({ userLocale: null, acceptLanguage: "en-GB,en;q=0.9" })).toBe("en");
  });
  it("지원하지 않는 값은 무시하고 한국어", () => {
    expect(pickLocale({ userLocale: "fr", acceptLanguage: "fr-FR" })).toBe("ko");
    expect(pickLocale({})).toBe("ko");
  });
});
