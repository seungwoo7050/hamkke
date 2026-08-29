import { describe, expect, it } from "vitest";
import { isLikelySleeping, timezoneDiffHours } from "./timezone";

// DST 영향을 피하려고 고정된 겨울철 시각을 기준으로 검증한다.
const WINTER = new Date("2026-01-15T12:00:00Z");

describe("timezoneDiffHours", () => {
  it("서울 기준 LA는 17시간 느리다(겨울, PST)", () => {
    expect(timezoneDiffHours("Asia/Seoul", "America/Los_Angeles", WINTER)).toBeCloseTo(-17);
  });

  it("같은 타임존이면 0", () => {
    expect(timezoneDiffHours("Asia/Seoul", "Asia/Seoul", WINTER)).toBe(0);
  });
});

describe("isLikelySleeping", () => {
  it("서울이 새벽 1시일 때 자고 있을 것으로 추정한다", () => {
    // 2026-01-15T16:00:00Z → Asia/Seoul 2026-01-16 01:00
    expect(isLikelySleeping("Asia/Seoul", new Date("2026-01-15T16:00:00Z"))).toBe(true);
  });

  it("같은 순간 LA는 오전 8시라 깨어 있을 것으로 추정한다", () => {
    expect(isLikelySleeping("America/Los_Angeles", new Date("2026-01-15T16:00:00Z"))).toBe(false);
  });
});
