import { describe, expect, it } from "vitest";
import { computeStreak, dayKey } from "./streak";

const today = { y: 2026, m: 6, d: 10 };

describe("computeStreak", () => {
  it("활동이 하나도 없으면 0", () => {
    expect(computeStreak([], today)).toEqual({ streak: 0, activeToday: false });
  });

  it("오늘 포함 3일 연속 활동이면 streak=3, activeToday=true", () => {
    expect(computeStreak(["2026-06-10", "2026-06-09", "2026-06-08"], today)).toEqual({
      streak: 3,
      activeToday: true,
    });
  });

  it("오늘은 아직 활동이 없지만 어제까지 연속이면 streak을 유지한다(끊긴 것으로 보지 않음)", () => {
    expect(computeStreak(["2026-06-09", "2026-06-08"], today)).toEqual({
      streak: 2,
      activeToday: false,
    });
  });

  it("어제 활동이 없으면 스트릭이 끊긴다", () => {
    expect(computeStreak(["2026-06-08"], today)).toEqual({ streak: 0, activeToday: false });
  });

  it("달과 해의 경계를 넘어 센다", () => {
    expect(
      computeStreak(["2026-01-01", "2025-12-31", "2025-12-30"], { y: 2026, m: 1, d: 1 }),
    ).toEqual({
      streak: 3,
      activeToday: true,
    });
  });

  it("상한 없이 센다 - 400일 연속이면 400", () => {
    const days: string[] = [];
    for (let i = 0; i < 400; i++) {
      const d = new Date(Date.UTC(2026, 5, 10 - i));
      days.push(dayKey({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }));
    }
    expect(computeStreak(days, today)).toEqual({ streak: 400, activeToday: true });
  });
});
