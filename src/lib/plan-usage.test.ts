import { describe, expect, it } from "vitest";
import { isAtLimit, isNearLimit } from "./plan-usage";

describe("plan usage", () => {
  it("한도의 80% 이상이면 근처로 본다(올림)", () => {
    expect(isNearLimit({ used: 23, limit: 30 })).toBe(false);
    expect(isNearLimit({ used: 24, limit: 30 })).toBe(true);
    // 3 * 0.8 = 2.4 → 3개 중 3개째부터가 아니라 2.4를 올린 3부터
    expect(isNearLimit({ used: 2, limit: 3 })).toBe(false);
    expect(isNearLimit({ used: 3, limit: 3 })).toBe(true);
  });

  it("한도에 닿으면 at-limit", () => {
    expect(isAtLimit({ used: 29, limit: 30 })).toBe(false);
    expect(isAtLimit({ used: 30, limit: 30 })).toBe(true);
  });
});
