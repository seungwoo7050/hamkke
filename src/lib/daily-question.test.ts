import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/i18n/messages";
import { DAILY_QUESTIONS, questionForDateKey, utcDateKey } from "./daily-question";

describe("하루 한 질문 선택", () => {
  it("UTC 날짜 기준이라 시간대가 다른 두 시각도 같은 날이면 같은 키가 된다", () => {
    // 서울 오전 8시 = UTC 전날 23시, 런던 자정 = UTC 당일 0시 — 서로 다른 UTC 날
    expect(utcDateKey(new Date("2026-09-27T23:00:00+09:00"))).toBe("2026-09-27");
    expect(utcDateKey(new Date("2026-09-27T08:00:00+09:00"))).toBe("2026-09-26");
  });

  it("같은 날짜는 항상 같은 질문, 다음 날은 다음 질문", () => {
    const today = questionForDateKey("2026-09-27");
    expect(questionForDateKey("2026-09-27")).toBe(today);

    const i = DAILY_QUESTIONS.indexOf(today);
    expect(questionForDateKey("2026-09-28")).toBe(
      DAILY_QUESTIONS[(i + 1) % DAILY_QUESTIONS.length],
    );
  });

  it("목록 길이만큼 지나면 처음으로 돌아온다", () => {
    const start = Date.parse("2026-09-27T00:00:00Z");
    const later = new Date(start + DAILY_QUESTIONS.length * 24 * 60 * 60 * 1000);
    expect(questionForDateKey(utcDateKey(later))).toBe(questionForDateKey("2026-09-27"));
  });

  it("key는 중복되지 않는다", () => {
    const keys = DAILY_QUESTIONS.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("모든 질문에 모든 언어의 문장이 있다", () => {
    for (const locale of Object.keys(MESSAGES) as (keyof typeof MESSAGES)[]) {
      const texts = MESSAGES[locale].questions as Record<string, string>;
      for (const q of DAILY_QUESTIONS) expect(texts[q.key], `${locale} ${q.key}`).toBeTruthy();
    }
  });
});
