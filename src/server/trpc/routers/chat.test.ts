// 로컬/원격 실제 DB + Supabase 프로젝트가 필요하다(send가 실제로 브로드캐스트도
// 호출한다). Realtime 수신 자체는 src/lib/supabase/realtime.test.ts에서 이미
// 검증했으므로 여기서는 send가 에러 없이 끝나는지와 DB/조회 로직만 확인한다.
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
    baseUrl: "http://localhost:3000",
  });
}

async function deleteR2Object(key: string) {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
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

  // cursor로 pop()한(=아직 안 보여준 다음 페이지 첫 항목) id를 그대로 쓰면
  // skip:1이 그 항목 자체를 건너뛰어버려 페이지마다 1개씩 유실된다 —
  // 실제로 이 버그가 있었어서(2026-09-26 수정) 전체 페이지를 순회해
  // 원본 집합과 정확히 일치하는지까지 확인한다.
  it("여러 페이지를 끝까지 순회하면 메시지가 하나도 유실되지 않는다", async () => {
    const caller = await callerFor(userAId);
    const sent = [];
    for (let i = 0; i < 5; i++) {
      sent.push(await caller.chat.send({ content: `메시지 ${i}` }));
    }

    const collected: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await caller.chat.list({ limit: 2, cursor });
      collected.push(...page.messages.map((m) => m.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(new Set(collected)).toEqual(new Set(sent.map((m) => m.id)));
    expect(collected).toHaveLength(5);
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

  it("unreadCount는 상대가 보낸 미읽음 메시지만 세고, markRead 후 0이 된다", async () => {
    await prisma.message.createMany({
      data: [
        { spaceId, senderId: userBId, content: "하나" },
        { spaceId, senderId: userBId, content: "둘" },
        { spaceId, senderId: userBId, content: "읽음", readAt: new Date() },
        { spaceId, senderId: userAId, content: "내가 보낸 것" },
      ],
    });

    const callerA = await callerFor(userAId);
    expect(await callerA.chat.unreadCount()).toBe(2);
    expect(await (await callerFor(userBId)).chat.unreadCount()).toBe(1);

    await callerA.chat.markRead();
    expect(await callerA.chat.unreadCount()).toBe(0);
  });

  it("이미지 업로드 URL로 실제 R2에 업로드하고, sendImage/list가 접근 가능한 signed URL을 돌려준다", async () => {
    const caller = await callerFor(userAId);

    const fakeImageBytes = new Uint8Array([1, 2, 3, 4]);
    const { uploadUrl, key } = await caller.chat.createImageUploadUrl({
      contentType: "image/png",
      size: fakeImageBytes.length,
    });

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: fakeImageBytes,
    });
    expect(uploadRes.ok).toBe(true);

    const message = await caller.chat.sendImage({ key });
    expect(message.type).toBe("image");
    // content가 R2 키가 아니라 실제로 열리는 signed URL로 바뀌어 있어야 한다.
    expect(message.content).toMatch(/^https:\/\/.*\.r2\.cloudflarestorage\.com\//);

    const downloadRes = await fetch(message.content);
    expect(downloadRes.ok).toBe(true);
    expect(new Uint8Array(await downloadRes.arrayBuffer())).toEqual(fakeImageBytes);

    const { messages } = await caller.chat.list({});
    const listed = messages.find((m) => m.id === message.id)!;
    expect(listed.content).toMatch(/^https:\/\/.*\.r2\.cloudflarestorage\.com\//);

    await deleteR2Object(key);
  });

  it("음성 업로드 URL로 실제 R2에 업로드하고, sendVoice/list가 접근 가능한 signed URL을 돌려준다", async () => {
    const caller = await callerFor(userAId);

    const fakeAudioBytes = new Uint8Array([9, 8, 7, 6, 5]);
    const { uploadUrl, key } = await caller.chat.createVoiceUploadUrl({
      contentType: "audio/webm",
      size: fakeAudioBytes.length,
    });

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "audio/webm" },
      body: fakeAudioBytes,
    });
    expect(uploadRes.ok).toBe(true);

    const message = await caller.chat.sendVoice({ key });
    expect(message.type).toBe("voice");
    expect(message.content).toMatch(/^https:\/\/.*\.r2\.cloudflarestorage\.com\//);

    const downloadRes = await fetch(message.content);
    expect(downloadRes.ok).toBe(true);
    expect(new Uint8Array(await downloadRes.arrayBuffer())).toEqual(fakeAudioBytes);

    await deleteR2Object(key);
  });

  it("크기 상한을 넘는 업로드 주소는 발급하지 않는다", async () => {
    const caller = await callerFor(userAId);
    await expect(
      caller.chat.createImageUploadUrl({ contentType: "image/png", size: 10 * 1024 * 1024 + 1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.chat.createVoiceUploadUrl({ contentType: "audio/webm", size: 5 * 1024 * 1024 + 1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("신고한 크기보다 큰 파일을 올리면 R2가 거절한다", async () => {
    const caller = await callerFor(userAId);
    const { uploadUrl, key } = await caller.chat.createImageUploadUrl({
      contentType: "image/png",
      size: 4,
    });

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array(4096),
    });
    expect(res.status).toBe(403);

    await deleteR2Object(key);
  });
});
