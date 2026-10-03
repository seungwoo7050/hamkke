// R2 업로드 한 건의 최대 크기(바이트). 서버는 이 값으로 업로드 주소 발급을
// 거절하고, 신고한 크기를 서명(ContentLength)에 넣어 다른 크기의 PUT은 R2가
// 403으로 막는다. 화면은 같은 값으로 미리 안내한다 - 그래서 server-only가 아니다.
//
// 영상은 서버가 길이를 알 수 없어(트랜스코딩 없이 원본 그대로 올린다) 크기로만 막는다.
// 휴대폰 1080p 영상 1분 남짓이다. 스페이스 저장 용량(src/lib/plan.ts)에도 그대로 잡힌다.
export const MAX_UPLOAD_BYTES = {
  image: 10 * 1024 * 1024,
  voice: 5 * 1024 * 1024,
  video: 100 * 1024 * 1024,
} as const;

export const MAX_UPLOAD_MB = {
  image: MAX_UPLOAD_BYTES.image / (1024 * 1024),
  voice: MAX_UPLOAD_BYTES.voice / (1024 * 1024),
  video: MAX_UPLOAD_BYTES.video / (1024 * 1024),
} as const;

// 올릴 수 있는 형식. 서버는 신고한 형식으로 주소를 서명하고, 등록할 때 R2에 실제로
// 올라간 형식이 이 목록에 있는지 다시 본다(src/server/uploads.ts). quicktime은 iPhone
// 기본 녹화(.mov)다.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export type VideoType = (typeof VIDEO_TYPES)[number];

/** 형식으로 사진인지 영상인지 가른다. 목록에 없으면 null. */
export function mediaKindOf(contentType: string): "image" | "video" | null {
  if ((IMAGE_TYPES as readonly string[]).includes(contentType)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(contentType)) return "video";
  return null;
}

// 음성 녹음은 비트레이트를 정하고 길이에 상한을 둔다. 브라우저 기본값(Chrome은
// 128kbps)에 길이 제한이 없으면 5분 반쯤 넘긴 녹음이 다 녹음한 뒤 위 상한에 걸려
// 버려졌다. 말소리는 64kbps(Opus)로 충분하고, 상한에 이르면 녹음을 멈추고 보낸다.
export const VOICE_BITS_PER_SECOND = 64_000;
export const MAX_VOICE_SECONDS = 5 * 60;
