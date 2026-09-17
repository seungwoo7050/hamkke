import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { questionForDateKey, utcDateKey } from "@/lib/daily-question";
import { translator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { createCallerFactory } from "../init";
import { appRouter } from "./_app";

// 푸시는 실제 FCM 대신 호출 여부·문구만 확인한다(발송 자체는 push 경로의 다른
// 기능들이 실기기로 검증됨).
const pushMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/push", () => ({ sendPushToSpacePartner: pushMock }));

const createCaller = createCallerFactory(appRouter);

async function callerFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createCaller({
    session: {
      user: { id: user.id, spaceId: user.spaceId, name: null, email: null, image: null },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    baseUrl: "http://localhost:3000",
  });
}

describe("question 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({
        data: { email: `test-question-a-${randomUUID()}@example.com`, name: "민준" },
      }),
      prisma.user.create({ data: { email: `test-question-b-${randomUUID()}@example.com` } }),
    ]);
    userAId = a.id;
    userBId = b.id;

    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    spaceId = space.id;
    await prisma.user.updateMany({ where: { id: { in: [userAId, userBId] } }, data: { spaceId } });
  });

  afterEach(async () => {
    await prisma.dailyAnswer.deleteMany({ where: { spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("스페이스 멤버가 아니면 조회할 수 없다", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-question-c-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(caller.question.today()).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  it("오늘의 질문은 UTC 날짜로 정해진다", async () => {
    const today = await (await callerFor(userAId)).question.today();
    const dateKey = utcDateKey(new Date());
    expect(today.dateKey).toBe(dateKey);
    expect(today.question).toEqual(questionForDateKey(dateKey));
    expect(today.myAnswer).toBeNull();
  });

  it("상대 답은 내가 답하기 전엔 숨겨지고, 답한 뒤에 공개된다", async () => {
    const callerA = await callerFor(userAId);
    const callerB = await callerFor(userBId);
    await callerB.question.answer({ content: "보고 싶어" });

    const before = await callerA.question.today();
    expect(before.partnerAnswered).toBe(true);
    expect(before.partnerAnswer).toBeNull();

    await callerA.question.answer({ content: "나도" });
    const after = await callerA.question.today();
    expect(after.myAnswer).toBe("나도");
    expect(after.partnerAnswer).toBe("보고 싶어");
  });

  it("같은 날 두 번 답할 수 없다", async () => {
    const caller = await callerFor(userAId);
    await caller.question.answer({ content: "첫 답" });
    await expect(caller.question.answer({ content: "고친 답" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("history는 내가 답한 날만 최신순으로, 그날의 상대 답과 함께 돌려준다", async () => {
    await prisma.dailyAnswer.createMany({
      data: [
        { spaceId, userId: userAId, dateKey: "2026-09-01", questionKey: "q001", content: "A1" },
        { spaceId, userId: userBId, dateKey: "2026-09-01", questionKey: "q001", content: "B1" },
        { spaceId, userId: userAId, dateKey: "2026-09-02", questionKey: "q002", content: "A2" },
        // A가 답하지 않은 날 — A의 history에 나오면 안 된다
        { spaceId, userId: userBId, dateKey: "2026-09-03", questionKey: "q003", content: "B3" },
      ],
    });

    const { items: history } = await (await callerFor(userAId)).question.history();

    expect(history.map((h) => h.dateKey)).toEqual(["2026-09-02", "2026-09-01"]);
    expect(history[0].partnerAnswer).toBeNull();
    expect(history[1]).toMatchObject({ myAnswer: "A1", partnerAnswer: "B1" });
    expect(history[1].question?.key).toBe("q001");
  });

  it("답하면 상대에게 내용 없이 '답했어요' 푸시를 보낸다", async () => {
    pushMock.mockClear();
    await (await callerFor(userAId)).question.answer({ content: "비밀스러운 답" });

    expect(pushMock).toHaveBeenCalledTimes(1);
    const [calledSpaceId, excludeUserId, build] = pushMock.mock.calls[0] as unknown as [
      string,
      string,
      (t: ReturnType<typeof translator>) => { body: string },
    ];
    expect(calledSpaceId).toBe(spaceId);
    expect(excludeUserId).toBe(userAId);
    // 문구는 받는 사람의 언어로 만든다(PRD §3.8) — 한국어는 조사까지 맞게.
    const ko = build(translator("ko")).body;
    expect(ko).toBe("민준이 오늘의 질문에 답했어요");
    expect(build(translator("en")).body).toBe("민준 answered today's question");
    expect(ko).not.toContain("비밀스러운 답");
  });

  it("history는 dateKey 커서로 이전 날을 이어서 준다", async () => {
    await prisma.dailyAnswer.createMany({
      data: ["01", "02", "03", "04", "05"].map((d) => ({
        spaceId,
        userId: userAId,
        dateKey: `2026-08-${d}`,
        questionKey: "q001",
        content: d,
      })),
    });
    const caller = await callerFor(userAId);

    const first = await caller.question.history({ limit: 2 });
    expect(first.items.map((h) => h.dateKey)).toEqual(["2026-08-05", "2026-08-04"]);
    expect(first.nextCursor).toBe("2026-08-04");

    const second = await caller.question.history({ limit: 2, cursor: first.nextCursor });
    expect(second.items.map((h) => h.dateKey)).toEqual(["2026-08-03", "2026-08-02"]);

    const last = await caller.question.history({ limit: 2, cursor: second.nextCursor });
    expect(last.items.map((h) => h.dateKey)).toEqual(["2026-08-01"]);
    expect(last.nextCursor).toBeUndefined();
  });
});
