import ky from "ky";
import pRetry, { AbortError } from "p-retry";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  mediaKindOf,
  type ImageType,
  type VideoType,
} from "./upload-limits";

export type ValidatedMedia =
  | { ok: true; kind: "image"; contentType: ImageType }
  | { ok: true; kind: "video"; contentType: VideoType }
  | { ok: false; reason: "type" }
  | { ok: false; reason: "size"; kind: "image" | "video"; maxMb: number };

/** 선택한 파일이 허용된 사진·영상 형식이고 크기 상한 이내인지 검사한다. */
export function validateMediaFile(file: { type: string; size: number }): ValidatedMedia {
  const kind = mediaKindOf(file.type);
  if (!kind) return { ok: false, reason: "type" };
  if (file.size > MAX_UPLOAD_BYTES[kind]) {
    return { ok: false, reason: "size", kind, maxMb: MAX_UPLOAD_MB[kind] };
  }
  return kind === "video"
    ? { ok: true, kind: "video", contentType: file.type as VideoType }
    : { ok: true, kind: "image", contentType: file.type as ImageType };
}

/**
 * 발급받은 R2 presigned PUT 주소로 바이트를 올린다. 모바일 네트워크의 일시적 오류나
 * 5xx에 대비해 ky와 p-retry로 재시도하되, 403(서명 불일치 등) 같은 4xx는 즉시 중단한다.
 */
export async function putToPresignedUrl(
  uploadUrl: string,
  body: Blob,
  contentType: string,
  { retries = 1 }: { retries?: number } = {},
) {
  await pRetry(
    async () => {
      const res = await ky.put(uploadUrl, {
        headers: { "Content-Type": contentType },
        body,
        retry: 0,
        throwHttpErrors: false,
      });
      if (!res.ok) {
        const err = new Error(`R2 업로드 실패: ${res.status}`);
        if (res.status !== 429 && res.status < 500) throw new AbortError(err);
        throw err;
      }
    },
    { retries, minTimeout: 100 },
  );
}
