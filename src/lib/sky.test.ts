import { describe, expect, it } from "vitest";
import { skyPhase } from "./sky";

// 2026-09-27T03:00Z = 서울 12시, 뉴욕 전날 23시, 런던 04시
const at = new Date("2026-09-27T03:00:00Z");

describe("skyPhase", () => {
  it("같은 순간이라도 시간대마다 하늘이 다르다", () => {
    expect(skyPhase("Asia/Seoul", at)).toBe("day");
    expect(skyPhase("America/New_York", at)).toBe("night");
    expect(skyPhase("Europe/London", at)).toBe("night");
  });

  it("경계: 05·17시는 dusk, 07시는 day, 20시는 night", () => {
    const seoul = (h: number) => new Date(Date.UTC(2026, 8, 27, h - 9));
    expect(skyPhase("Asia/Seoul", seoul(5))).toBe("dusk");
    expect(skyPhase("Asia/Seoul", seoul(7))).toBe("day");
    expect(skyPhase("Asia/Seoul", seoul(17))).toBe("dusk");
    expect(skyPhase("Asia/Seoul", seoul(20))).toBe("night");
  });
});
