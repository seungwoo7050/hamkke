// 실제 R2에 왕복한다.
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { headUpload } from "@/lib/r2";
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
  // 업로드 키(pending/…)와 등록 후 옮겨진 정식 키를 둘 다 지운다(없는 키 삭제도 성공).
  for (const k of [key, key.replace(/^pending\//, "")]) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: k }));
  }
}

// 실제 R2 왕복(업로드·HeadObject·삭제)이 여러 번이라 기본 5초로는 빠듯하다.
describe("moment 라우터 (통합)", { timeout: 30_000 }, () => {
  let userAId: string;
  let spaceId: string;

  beforeEach(async () => {
    const a = await prisma.user.create({
      data: { email: `test-moment-a-${randomUUID()}@example.com` },
    });
    userAId = a.id;

    const space = await prisma.space.create({
      data: {
        status: "active",
        inviteCode: randomUUID().slice(0, 6).toUpperCase(),
        inviteCodeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    spaceId = space.id;
    await prisma.user.update({ where: { id: userAId }, data: { spaceId } });
  });

  afterEach(async () => {
    await prisma.moment.deleteMany({ where: { spaceId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.space.delete({ where: { id: spaceId } });
  });

  it("업로드 URL로 실제 R2에 올리고, create/list가 접근 가능한 signed URL을 돌려준다", async () => {
    const caller = await callerFor(userAId);

    const fakeImageBytes = new Uint8Array([1, 2, 3, 4]);
    const { uploadUrl, key } = await caller.moment.createUploadUrl({
      contentType: "image/png",
      size: fakeImageBytes.length,
    });

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: fakeImageBytes,
    });
    expect(uploadRes.ok).toBe(true);

    const moment = await caller.moment.create({ key, caption: "오늘의 하늘" });
    expect(moment.caption).toBe("오늘의 하늘");
    expect(moment.mediaUrl).toMatch(/^https:\/\/.*\.r2\.cloudflarestorage\.com\//);

    const downloadRes = await fetch(moment.mediaUrl);
    expect(downloadRes.ok).toBe(true);
    expect(new Uint8Array(await downloadRes.arrayBuffer())).toEqual(fakeImageBytes);

    const { moments } = await caller.moment.list({});
    const listed = moments.find((m) => m.id === moment.id)!;
    expect(listed.mediaUrl).toMatch(/^https:\/\/.*\.r2\.cloudflarestorage\.com\//);

    await deleteR2Object(key);
  });

  it("cursor 페이지네이션이 동작한다", async () => {
    const caller = await callerFor(userAId);
    const keys: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { uploadUrl, key } = await caller.moment.createUploadUrl({
        contentType: "image/png",
        size: 1,
      });
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array([i]),
      });
      await caller.moment.create({ key });
      keys.push(key);
    }

    const page1 = await caller.moment.list({ limit: 2 });
    expect(page1.moments).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await caller.moment.list({ limit: 2, cursor: page1.nextCursor });
    expect(page2.moments).toHaveLength(1);

    await Promise.all(keys.map(deleteR2Object));
  });

  it("삭제하면 목록에서 사라진다", async () => {
    const caller = await callerFor(userAId);
    const { uploadUrl, key } = await caller.moment.createUploadUrl({
      contentType: "image/png",
      size: 1,
    });
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array([1]),
    });
    const moment = await caller.moment.create({ key });

    await caller.moment.delete({ id: moment.id });
    expect((await caller.moment.list({})).moments).toHaveLength(0);
    // R2 파일도 함께 지워진다(정식 경로, 임시 경로 모두).
    expect(await headUpload(key.replace(/^pending\//, ""))).toBeNull();
    expect(await headUpload(key)).toBeNull();
  });

  // 화면은 올린 사람에게만 삭제 버튼을 보인다. 서버도 같은 규칙이어야 상대가
  // API로 내 사진을 지울 수 없다(캡슐의 보낸 사람 규칙과 같다).
  it("같은 스페이스의 상대도 내가 올린 사진은 지울 수 없다", async () => {
    const partner = await prisma.user.create({
      data: { email: `test-moment-p-${randomUUID()}@example.com`, spaceId },
    });
    try {
      const moment = await prisma.moment.create({
        data: { spaceId, uploaderId: userAId, mediaUrl: `moments/${spaceId}/${randomUUID()}` },
      });

      await (await callerFor(partner.id)).moment.delete({ id: moment.id });

      expect(await prisma.moment.findUnique({ where: { id: moment.id } })).not.toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: partner.id } });
    }
  });

  it("스페이스 멤버가 아니면 호출할 수 없다(spaceProcedure)", async () => {
    const outsider = await prisma.user.create({
      data: { email: `test-moment-b-${randomUUID()}@example.com` },
    });
    try {
      const caller = await callerFor(outsider.id);
      await expect(
        caller.moment.createUploadUrl({ contentType: "image/png", size: 1 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  it("무료 티어는 사진 개수 한도를 넘으면 업로드 URL 발급 자체를 거부한다", async () => {
    // 실제 R2 업로드 없이 개수만 채운다 - createUploadUrl은 count만 본다.
    await prisma.moment.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        spaceId,
        uploaderId: userAId,
        mediaUrl: `moments/${spaceId}/fake-${i}`,
      })),
    });

    const caller = await callerFor(userAId);
    await expect(
      caller.moment.createUploadUrl({ contentType: "image/png", size: 1 }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("프리미엄이면 한도를 넘어도 업로드 URL을 발급받는다", async () => {
    await prisma.moment.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        spaceId,
        uploaderId: userAId,
        mediaUrl: `moments/${spaceId}/fake-${i}`,
      })),
    });
    await prisma.subscription.create({
      data: {
        spaceId,
        stripeCustomerId: `cus_fake_${randomUUID()}`,
        stripeSubscriptionId: `sub_fake_${randomUUID()}`,
        plan: "premium",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const caller = await callerFor(userAId);
    const { key } = await caller.moment.createUploadUrl({ contentType: "image/png", size: 1 });
    expect(key).toContain(spaceId);

    await prisma.subscription.deleteMany({ where: { spaceId } });
  });

  it("올리지 않은 파일이나 다른 스페이스의 파일로는 사진을 등록할 수 없다", async () => {
    const caller = await callerFor(userAId);
    const { key } = await caller.moment.createUploadUrl({ contentType: "image/png", size: 1 });
    await expect(caller.moment.create({ key })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.moment.create({ key: `moments/other-space/${randomUUID()}` }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prisma.moment.count({ where: { spaceId } })).toBe(0);
  });

  it("업로드 주소를 미리 받아 두어도 한도에 이르면 등록을 거부한다", async () => {
    const caller = await callerFor(userAId);
    const { uploadUrl, key } = await caller.moment.createUploadUrl({
      contentType: "image/png",
      size: 1,
    });
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array([1]),
    });
    await prisma.moment.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        spaceId,
        uploaderId: userAId,
        mediaUrl: `moments/${spaceId}/fake-${i}`,
      })),
    });

    await expect(caller.moment.create({ key })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteR2Object(key);
  });

  it("업로드는 임시 경로에 올라가고, 등록하면 정식 경로로 옮겨진다", async () => {
    const caller = await callerFor(userAId);
    const { uploadUrl, key } = await caller.moment.createUploadUrl({
      contentType: "image/png",
      size: 1,
    });
    expect(key).toMatch(new RegExp(`^pending/moments/${spaceId}/`));
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array([1]),
    });

    const moment = await caller.moment.create({ key });
    const stored = await prisma.moment.findUniqueOrThrow({ where: { id: moment.id } });
    expect(stored.mediaUrl).toBe(key.replace(/^pending\//, ""));
    expect(await headUpload(key)).toBeNull();
    expect(await headUpload(stored.mediaUrl)).toMatchObject({ size: 1, contentType: "image/png" });

    // 같은 임시 키로 두 번 등록할 수 없다(이미 옮겨졌다).
    await expect(caller.moment.create({ key })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await deleteR2Object(key);
  });

  // 확인(사진 수·용량)과 등록 사이가 비어 있으면 동시에 들어온 등록이 모두 같은 수를 보고
  // 통과한다. 화면은 한 장씩 올리지만 두 사람이 같은 순간 올리면 생기는 일이다.
  async function uploadPending(caller: Awaited<ReturnType<typeof callerFor>>) {
    const bytes = new Uint8Array([1]);
    const { uploadUrl, key } = await caller.moment.createUploadUrl({
      contentType: "image/png",
      size: bytes.length,
    });
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: bytes,
    });
    return key;
  }

  it("한도 직전에 여러 장을 동시에 등록해도 한도를 넘지 않는다", async () => {
    const caller = await callerFor(userAId);
    const keys = await Promise.all([1, 2, 3, 4, 5].map(() => uploadPending(caller)));
    await prisma.moment.createMany({
      data: Array.from({ length: 29 }, (_, i) => ({
        spaceId,
        uploaderId: userAId,
        mediaUrl: `moments/${spaceId}/fake-${i}`,
      })),
    });

    const results = await Promise.allSettled(keys.map((key) => caller.moment.create({ key })));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.moment.count({ where: { spaceId } })).toBe(30);
    for (const key of keys) await deleteR2Object(key);
  });

  it("같은 임시 키를 동시에 여러 번 등록해도 사진은 하나만 생긴다", async () => {
    const caller = await callerFor(userAId);
    const key = await uploadPending(caller);

    const results = await Promise.allSettled([1, 2, 3].map(() => caller.moment.create({ key })));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.moment.count({ where: { spaceId } })).toBe(1);
    await deleteR2Object(key);
  });
});
