import { describe, expect, it } from "vitest";
import { generateInviteCode, inviteCodeExpiryDate, INVITE_CODE_TTL_MS } from "./invite-code";

describe("generateInviteCode", () => {
  it("생성된 코드는 6자리다", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("혼동되는 문자(0, O, 1, I, L)를 포함하지 않는다", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateInviteCode()).not.toMatch(/[0O1IL]/);
    }
  });
});

describe("inviteCodeExpiryDate", () => {
  it("기준 시각으로부터 24시간 뒤를 반환한다", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(inviteCodeExpiryDate(from).getTime()).toBe(from.getTime() + INVITE_CODE_TTL_MS);
  });
});
