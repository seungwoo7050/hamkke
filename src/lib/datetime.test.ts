import { describe, expect, it } from "vitest";
import {
  dateOnly,
  daysBetween,
  formatDateTime,
  formatDayLabel,
  formatTime,
  formatYMD,
  nextOccurrence,
  todayIn,
} from "./datetime";

// 2026-09-27T15:12Z = 서울 9/28(월) 00:12, 뉴욕 9/27(일) 11:12
const at = new Date("2026-09-27T15:12:00Z");

describe("formatTime", () => {
  it("로케일 데이터 없이 오전/오후 12시간제로 만든다", () => {
    expect(formatTime(at, "Asia/Seoul")).toBe("오전 12:12");
    expect(formatTime(at, "America/New_York")).toBe("오전 11:12");
    expect(formatTime(new Date("2026-09-27T04:05:00Z"), "Asia/Seoul")).toBe("오후 1:05");
    expect(formatTime(new Date("2026-09-27T03:00:00Z"), "Asia/Seoul")).toBe("오후 12:00");
  });
});

describe("todayIn / dateOnly", () => {
  it("같은 순간이라도 시간대마다 오늘이 다르다", () => {
    expect(todayIn("Asia/Seoul", at)).toEqual({ y: 2026, m: 9, d: 28 });
    expect(todayIn("America/New_York", at)).toEqual({ y: 2026, m: 9, d: 27 });
  });

  it("날짜 필드는 UTC 자정 저장값을 그 달력 날짜 그대로 읽는다(뉴욕에서 하루 당겨지지 않음)", () => {
    expect(dateOnly(new Date("2026-11-02T00:00:00Z"))).toEqual({ y: 2026, m: 11, d: 2 });
    expect(dateOnly("2026-11-02T00:00:00.000Z")).toEqual({ y: 2026, m: 11, d: 2 });
  });
});

describe("daysBetween / nextOccurrence", () => {
  const today = { y: 2026, m: 6, d: 1 };

  it("미래는 양수, 오늘은 0, 과거는 음수", () => {
    expect(daysBetween(today, { y: 2026, m: 6, d: 10 })).toBe(9);
    expect(daysBetween(today, today)).toBe(0);
    expect(daysBetween(today, { y: 2026, m: 5, d: 1 })).toBe(-31);
  });

  it("반복 기념일은 올해 아직 안 지났으면 올해, 지났으면 내년, 오늘이면 올해", () => {
    expect(nextOccurrence({ y: 2020, m: 12, d: 25 }, true, today)).toEqual({
      y: 2026,
      m: 12,
      d: 25,
    });
    expect(nextOccurrence({ y: 2020, m: 1, d: 1 }, true, today)).toEqual({ y: 2027, m: 1, d: 1 });
    expect(nextOccurrence({ y: 2020, m: 6, d: 1 }, true, today)).toEqual({ y: 2026, m: 6, d: 1 });
  });

  it("반복이 아니면 원래 날짜 그대로", () => {
    expect(nextOccurrence({ y: 2020, m: 5, d: 1 }, false, today)).toEqual({ y: 2020, m: 5, d: 1 });
  });
});

describe("표기", () => {
  it("날짜·요일", () => {
    expect(formatYMD({ y: 2026, m: 9, d: 29 }, { weekday: true })).toBe("9월 29일 (화)");
    expect(formatYMD({ y: 2026, m: 9, d: 29 }, { year: true })).toBe("2026년 9월 29일");
  });

  it("날짜+시각", () => {
    expect(formatDateTime(new Date("2026-09-29T12:00:00Z"), "Asia/Seoul")).toBe(
      "9월 29일 (화) 오후 9:00",
    );
  });

  it("채팅 구분선 — 오늘·어제·그 전(올해가 아니면 연도)", () => {
    const now = new Date("2026-09-28T03:00:00Z");
    expect(formatDayLabel(new Date("2026-09-28T01:00:00Z"), "Asia/Seoul", now)).toBe("오늘");
    expect(formatDayLabel(new Date("2026-09-27T01:00:00Z"), "Asia/Seoul", now)).toBe("어제");
    expect(formatDayLabel(new Date("2026-09-20T01:00:00Z"), "Asia/Seoul", now)).toBe(
      "9월 20일 (일)",
    );
    expect(formatDayLabel(new Date("2025-12-31T01:00:00Z"), "Asia/Seoul", now)).toBe(
      "2025년 12월 31일 (수)",
    );
  });
});
