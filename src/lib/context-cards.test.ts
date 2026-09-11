import { describe, expect, it } from "vitest";
import { selectContextCards, type ContextInputs } from "./context-cards";

const none: ContextInputs = {
  todayAnniversaries: [],
  arrivedCapsules: 0,
  pendingQuestion: null,
  nextCountdown: null,
};

describe("selectContextCards", () => {
  it("해당하는 게 없으면 카드도 없다", () => {
    expect(selectContextCards(none)).toEqual([]);
  });

  it("우선순위: 오늘 기념일 > 도착한 캡슐 > 하루 한 질문 > D-day, 최대 2장", () => {
    const all: ContextInputs = {
      todayAnniversaries: ["우리 300일"],
      arrivedCapsules: 1,
      pendingQuestion: { partnerAnswered: true },
      nextCountdown: { title: "다음 만남", days: 18 },
    };
    expect(selectContextCards(all).map((c) => c.kind)).toEqual(["anniversary", "capsule"]);
    expect(selectContextCards({ ...all, todayAnniversaries: [] }).map((c) => c.kind)).toEqual([
      "capsule",
      "question",
    ]);
    expect(
      selectContextCards({ ...all, todayAnniversaries: [], arrivedCapsules: 0 }).map((c) => c.kind),
    ).toEqual(["question", "countdown"]);
  });

  it("같은 날 기념일이 둘이면 둘 다 카드가 되고 나머지는 밀린다", () => {
    const cards = selectContextCards({
      ...none,
      todayAnniversaries: ["처음 만난 날", "지우 생일"],
      nextCountdown: { title: "다음 만남", days: 3 },
    });
    expect(cards).toEqual([
      { kind: "anniversary", title: "처음 만난 날" },
      { kind: "anniversary", title: "지우 생일" },
    ]);
  });

  it("첫날 안내는 가장 뒤 — 다른 카드가 있으면 밀려난다", () => {
    const setup = { needsAnniversary: true, needsMeetupDate: true };
    expect(selectContextCards({ ...none, setup }).map((c) => c.kind)).toEqual([
      "setup-meetup",
      "setup-anniversary",
    ]);
    expect(
      selectContextCards({ ...none, pendingQuestion: { partnerAnswered: false }, setup }).map(
        (c) => c.kind,
      ),
    ).toEqual(["question", "setup-meetup"]);
  });
});
