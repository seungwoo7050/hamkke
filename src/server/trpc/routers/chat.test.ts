// 로컬/원격 실제 DB + Supabase 프로젝트가 필요하다(send가 실제로 브로드캐스트도
// 호출한다). Realtime 수신 자체는 src/lib/supabase/realtime.test.ts에서 이미
// 검증했으므로 여기서는 send가 에러 없이 끝나는지와 DB/조회 로직만 확인한다.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCallerFactory } from "../init";
import { appRouter } from "./_app";

const createCaller = createCallerFactory(appRouter);

async function callerFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createCaller({
    session: {
      user: { id: user.id, spaceId: user.spaceId, name: null, email: null, image: null },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
}

describe("chat 라우터 (통합)", () => {
  let userAId: string;
  let userBId: string;
  let spaceId: string;

  beforeEach(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `test-chat-a-${randomUUID()}@example.com` } }),
      prisma.user.create({ data: { email: `test-chat-b-${randomUUID()}@example.com` } }),
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
    await prisma.message.deleteMany({ where: { spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("스페이스 멤버가 아니면 보낼 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-chat-c-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(caller.chat.send({ content: "안녕" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  it("보낸 메시지를 상대가 조회할 수 있고, 시간순으로 정렬된다", async () => {
    const callerA = await callerFor(userAId);
    const callerB = await callerFor(userBId);

    const first = await callerA.chat.send({ content: "안녕!" });
    const second = await callerB.chat.send({ content: "안녕하세요" });

    expect(first.senderId).toBe(userAId);
    expect(first.type).toBe("text");

    const { messages, nextCursor } = await callerA.chat.list({});
    expect(messages.map((m) => m.id)).toEqual([first.id, second.id]);
    expect(nextCursor).toBeUndefined();
  });

  it("cursor 페이지네이션이 동작한다", async () => {
    const caller = await callerFor(userAId);
    for (let i = 0; i < 5; i++) {
      await caller.chat.send({ content: `메시지 ${i}` });
    }

    const page1 = await caller.chat.list({ limit: 2 });
    expect(page1.messages).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await caller.chat.list({ limit: 2, cursor: page1.nextCursor });
    expect(page2.messages).toHaveLength(2);
    expect(page2.messages[0].id).not.toBe(page1.messages[0].id);
  });

  it("markRead는 상대가 보낸 미읽음 메시지만 읽음 처리한다", async () => {
    const callerA = await callerFor(userAId);
    const callerB = await callerFor(userBId);

    const fromA = await callerA.chat.send({ content: "A가 보냄" });
    const fromB = await callerB.chat.send({ content: "B가 보냄" });

    await callerA.chat.markRead();

    const { messages } = await callerA.chat.list({});
    const updatedFromA = messages.find((m) => m.id === fromA.id)!;
    const updatedFromB = messages.find((m) => m.id === fromB.id)!;

    // A가 markRead를 호출했으므로 "B가 보낸" 메시지만 읽음 처리된다.
    expect(updatedFromA.readAt).toBeNull();
    expect(updatedFromB.readAt).not.toBeNull();
  });
});
