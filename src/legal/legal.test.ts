import { describe, expect, it } from "vitest";
import { LOCATION_PING_RETENTION_MS } from "@/server/request-limits";
import { LEGAL_SLUGS, legalDoc } from ".";

const DAY = 24 * 60 * 60 * 1000;

describe("정책 문서", () => {
  it.each(LEGAL_SLUGS)("%s: 한국어(기준본)와 영어판의 절 구성이 같다", (slug) => {
    const ko = legalDoc(slug, "ko", "?");
    const en = legalDoc(slug, "en", "?");
    expect(en.sections.length).toBe(ko.sections.length);
    expect(en.sections.map((s) => s.blocks.length)).toEqual(
      ko.sections.map((s) => s.blocks.length),
    );
  });

  it("영어판이 없는 언어는 한국어 기준본을 보여 준다", () => {
    expect(legalDoc("privacy", "ja", "?").title).toBe(legalDoc("privacy", "ko", "?").title);
  });

  // 문서에 적은 보관 기간이 코드와 어긋나면 약속을 어기는 셈이다.
  it("위치 좌표 보관 기간(7일)이 코드와 같다", () => {
    expect(LOCATION_PING_RETENTION_MS).toBe(7 * DAY);
    const text = JSON.stringify(legalDoc("location", "ko", "?"));
    expect(text).toContain("7일 동안 보관");
  });
});
