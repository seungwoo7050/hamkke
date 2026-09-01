import { describe, expect, it } from "vitest";
import { daysUntil, nextOccurrence } from "./anniversary";

describe("nextOccurrence", () => {
  it("recurring이 아니면 원래 날짜를 그대로 돌려준다", () => {
    const date = new Date("2020-05-01T00:00:00");
    expect(nextOccurrence(date, false, new Date("2026-06-01"))).toEqual(date);
  });

  it("recurring이고 올해 발생일이 아직 안 지났으면 올해로 보정한다", () => {
    const date = new Date("2020-12-25T00:00:00");
    const from = new Date("2026-01-01T00:00:00");
    const result = nextOccurrence(date, true, from);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(25);
  });

  it("recurring이고 올해 발생일이 이미 지났으면 내년으로 넘긴다", () => {
    const date = new Date("2020-01-01T00:00:00");
    const from = new Date("2026-06-01T00:00:00");
    const result = nextOccurrence(date, true, from);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it("recurring이고 오늘이 바로 그 날이면 올해를 그대로 유지한다(아직 안 지남)", () => {
    const date = new Date("2020-06-01T00:00:00");
    const from = new Date("2026-06-01T00:00:00");
    const result = nextOccurrence(date, true, from);
    expect(result.getFullYear()).toBe(2026);
  });
});

describe("daysUntil", () => {
  it("미래 날짜는 양수를 돌려준다", () => {
    expect(daysUntil(new Date("2026-06-10"), new Date("2026-06-01"))).toBe(9);
  });

  it("오늘이면 0", () => {
    expect(daysUntil(new Date("2026-06-01"), new Date("2026-06-01"))).toBe(0);
  });

  it("과거 날짜는 음수를 돌려준다", () => {
    expect(daysUntil(new Date("2026-05-01"), new Date("2026-06-01"))).toBe(-31);
  });
});
