import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("활동이 하나도 없으면 0", () => {
    expect(computeStreak([], new Date("2026-06-10"))).toEqual({ streak: 0, activeToday: false });
  });

  it("오늘 포함 3일 연속 활동이면 streak=3, activeToday=true", () => {
    const from = new Date("2026-06-10T15:00:00");
    const dates = [
      new Date("2026-06-10T09:00:00"),
      new Date("2026-06-09T23:00:00"),
      new Date("2026-06-08T01:00:00"),
    ];
    expect(computeStreak(dates, from)).toEqual({ streak: 3, activeToday: true });
  });

  it("오늘은 아직 활동이 없지만 어제까지 연속이면 streak을 유지한다(끊긴 것으로 보지 않음)", () => {
    const from = new Date("2026-06-10T09:00:00");
    const dates = [new Date("2026-06-09T20:00:00"), new Date("2026-06-08T20:00:00")];
    expect(computeStreak(dates, from)).toEqual({ streak: 2, activeToday: false });
  });

  it("어제 활동이 없으면 스트릭이 끊긴다", () => {
    const from = new Date("2026-06-10T09:00:00");
    const dates = [new Date("2026-06-08T20:00:00")];
    expect(computeStreak(dates, from)).toEqual({ streak: 0, activeToday: false });
  });

  it("같은 날 여러 번 활동해도 하루로만 센다", () => {
    const from = new Date("2026-06-10T21:00:00");
    const dates = [
      new Date("2026-06-10T09:00:00"),
      new Date("2026-06-10T10:00:00"),
      new Date("2026-06-10T20:00:00"),
    ];
    expect(computeStreak(dates, from)).toEqual({ streak: 1, activeToday: true });
  });
});
