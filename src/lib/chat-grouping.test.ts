import { describe, expect, it } from "vitest";
import { groupPositions, type GroupableItem } from "./chat-grouping";

const msg = (senderId: string, iso: string): GroupableItem => ({
  kind: "message",
  senderId,
  at: new Date(iso),
});

describe("groupPositions", () => {
  const tz = "Asia/Seoul";

  it("같은 사람·같은 분이면 한 묶음, 마지막에만 last", () => {
    const items = [
      msg("a", "2026-09-27T05:00:05Z"),
      msg("a", "2026-09-27T05:00:40Z"),
      msg("a", "2026-09-27T05:00:59Z"),
    ];
    expect(groupPositions(items, tz)).toEqual([
      { first: true, last: false },
      { first: false, last: false },
      { first: false, last: true },
    ]);
  });

  it("분이 바뀌거나 보낸 사람이 바뀌면 끊긴다", () => {
    const items = [
      msg("a", "2026-09-27T05:00:50Z"),
      msg("a", "2026-09-27T05:01:05Z"),
      msg("b", "2026-09-27T05:01:10Z"),
    ];
    expect(groupPositions(items, tz).map((p) => [p.first, p.last])).toEqual([
      [true, true],
      [true, true],
      [true, true],
    ]);
  });

  it("사이에 터치가 끼면 끊긴다", () => {
    const items: GroupableItem[] = [
      msg("a", "2026-09-27T05:00:05Z"),
      { kind: "touch", at: new Date("2026-09-27T05:00:10Z") },
      msg("a", "2026-09-27T05:00:20Z"),
    ];
    expect(groupPositions(items, tz).every((p) => p.first && p.last)).toBe(true);
  });
});
