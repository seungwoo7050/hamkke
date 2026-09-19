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
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
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
    // R2 파일도 함께 지워진다.
    expect(await headUpload(key)).toBeNull();
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
    // 실제 R2 업로드 없이 개수만 채운다 — createUploadUrl은 count만 본다.
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
});
