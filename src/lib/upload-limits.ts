// R2 업로드 한 건의 최대 크기(바이트). 서버는 이 값으로 업로드 주소 발급을
// 거절하고, 신고한 크기를 서명(ContentLength)에 넣어 다른 크기의 PUT은 R2가
// 403으로 막는다. 화면은 같은 값으로 미리 안내한다 — 그래서 server-only가 아니다.
export const MAX_UPLOAD_BYTES = {
  image: 10 * 1024 * 1024,
  voice: 5 * 1024 * 1024,
} as const;

export const MAX_UPLOAD_MB = {
  image: MAX_UPLOAD_BYTES.image / (1024 * 1024),
  voice: MAX_UPLOAD_BYTES.voice / (1024 * 1024),
} as const;

// 음성 녹음은 비트레이트를 정하고 길이에 상한을 둔다. 브라우저 기본값(Chrome은
// 128kbps)에 길이 제한이 없으면 5분 반쯤 넘긴 녹음이 다 녹음한 뒤 위 상한에 걸려
// 버려졌다. 말소리는 64kbps(Opus)로 충분하고, 상한에 이르면 녹음을 멈추고 보낸다.
export const VOICE_BITS_PER_SECOND = 64_000;
export const MAX_VOICE_SECONDS = 5 * 60;
