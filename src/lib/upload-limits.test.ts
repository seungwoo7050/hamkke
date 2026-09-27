import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, MAX_VOICE_SECONDS, VOICE_BITS_PER_SECOND } from "./upload-limits";

describe("음성 메시지 길이와 업로드 상한", () => {
  // 녹음에 길이 상한이 없으면, 상한(5MB)을 넘긴 긴 녹음은 다 녹음한 뒤에 버려진다
  // (Chrome 기본 128kbps에서 약 5.6분). 가장 긴 녹음이 상한 안에 들어야 한다.
  it("가장 긴 녹음도 컨테이너 오버헤드를 넉넉히(25%) 잡아 상한 안에 든다", () => {
    const longest = ((MAX_VOICE_SECONDS * VOICE_BITS_PER_SECOND) / 8) * 1.25;
    expect(longest).toBeLessThanOrEqual(MAX_UPLOAD_BYTES.voice);
  });
});
