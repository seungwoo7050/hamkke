import "server-only";
import type { Check } from "@/server/rate-limit";

// 기능별 요청 횟수 한도(ARCHITECTURE.md §7). 2인 대화에서 사람이 치는 속도로는
// 닿지 않게 넉넉히, 스크립트로 DB·Realtime·푸시를 채우는 것은 막을 만큼.
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const REQUEST_LIMITS = {
  chatMessage: [
    { max: 60, windowMs: MINUTE },
    { max: 3000, windowMs: DAY },
  ],
  // 대화 이미지·음성과 사진 업로드 주소를 합산한다.
  uploadUrl: [
    { max: 30, windowMs: 10 * MINUTE },
    { max: 300, windowMs: DAY },
  ],
} as const;

export const chatMessageCheck = (userId: string): Check[] => [
  { bucket: "chat.send", subject: userId, limits: REQUEST_LIMITS.chatMessage },
];

export const uploadUrlCheck = (userId: string): Check[] => [
  { bucket: "upload.url", subject: userId, limits: REQUEST_LIMITS.uploadUrl },
];
