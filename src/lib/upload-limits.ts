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
