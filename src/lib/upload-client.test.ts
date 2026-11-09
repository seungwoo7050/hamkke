import { afterEach, describe, expect, it, vi } from "vitest";
import { putToPresignedUrl, validateMediaFile } from "./upload-client";
import { MAX_UPLOAD_BYTES } from "./upload-limits";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateMediaFile", () => {
  it("허용된 사진·영상 형식과 크기를 통과시킨다", () => {
    expect(validateMediaFile({ type: "image/jpeg", size: 1024 })).toEqual({
      ok: true,
      kind: "image",
      contentType: "image/jpeg",
    });
    expect(validateMediaFile({ type: "video/mp4", size: 1024 })).toEqual({
      ok: true,
      kind: "video",
      contentType: "video/mp4",
    });
  });

  it("지원하지 않는 형식이나 크기 초과를 구분해 거절한다", () => {
    expect(validateMediaFile({ type: "application/pdf", size: 100 })).toEqual({
      ok: false,
      reason: "type",
    });
    expect(validateMediaFile({ type: "image/png", size: MAX_UPLOAD_BYTES.image + 1 })).toEqual({
      ok: false,
      reason: "size",
      kind: "image",
      maxMb: 10,
    });
  });
});

describe("putToPresignedUrl", () => {
  it("일시적 503 실패 뒤 재시도해 R2 PUT 업로드를 마친다", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return new Response(null, { status: calls === 1 ? 503 : 200 });
    });

    await putToPresignedUrl(
      "https://r2.example.com/upload",
      new Blob(["hello"], { type: "image/png" }),
      "image/png",
    );
    expect(calls).toBe(2);
  });

  it("403 서명 거절은 재시도하지 않고 즉시 던진다", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return new Response(null, { status: 403 });
    });

    await expect(
      putToPresignedUrl(
        "https://r2.example.com/upload",
        new Blob(["hello"], { type: "image/png" }),
        "image/png",
      ),
    ).rejects.toThrow("R2 업로드 실패: 403");
    expect(calls).toBe(1);
  });
});
