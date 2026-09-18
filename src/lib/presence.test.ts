import { describe, expect, it } from "vitest";
import { isPartnerPresent } from "./presence";

describe("isPartnerPresent", () => {
  it("나만 있으면 false, 상대 세션이 하나라도 있으면 true", () => {
    expect(isPartnerPresent({}, "me")).toBe(false);
    expect(isPartnerPresent({ me: [{}] }, "me")).toBe(false);
    expect(isPartnerPresent({ me: [{}], partner: [{}, {}] }, "me")).toBe(true);
  });

  it("세션이 비어 있는 키는 없는 것으로 본다", () => {
    expect(isPartnerPresent({ partner: [] }, "me")).toBe(false);
  });
});
