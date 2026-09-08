import { describe, expect, it } from "vitest";
import { relativeTime, relativeTimeAdverb } from "./relative-time";

const now = new Date("2026-09-27T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("relativeTime", () => {
  it("단위별로 내림한다", () => {
    expect(relativeTime(ago(30_000), now)).toBe("방금");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5분 전");
    expect(relativeTime(ago(3 * 3_600_000 + 50 * 60_000), now)).toBe("3시간 전");
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe("2일 전");
  });

  it("미래 시각(기기 시계 오차)은 방금으로 본다", () => {
    expect(relativeTime(new Date(now.getTime() + 60_000), now)).toBe("방금");
  });

  it("부사형은 '방금'에만 조사를 붙이지 않는다", () => {
    expect(relativeTimeAdverb(ago(10_000), now)).toBe("방금");
    expect(relativeTimeAdverb(ago(3 * 3_600_000), now)).toBe("3시간 전에");
  });
});
