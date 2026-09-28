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
  // 화면은 15초에 한 번 보낸다(src/app/home/location-context.tsx). 서버는 그보다
  // 조금 짧게 잡아 정상 전송은 막지 않고, 그보다 잦은 전송은 저장·브로드캐스트
  // 없이 무시한다.
  locationSend: [{ max: 1, windowMs: 10_000 }],
  // Checkout·Customer Portal 세션 생성(합산) - 매번 Stripe API를 부르고, 카드
  // 테스팅(훔친 카드 시험 결제)의 입구가 되지 않게.
  billingSession: [{ max: 10, windowMs: 60 * MINUTE }],
  // 모든 변경 요청(mutation)의 사용자별 전체 상한 - 위 개별 한도가 없는
  // 쓰기(터치·일정·캡슐 등)를 스크립트로 반복해 DB·푸시를 채우는 것의 안전망.
  anyMutation: [{ max: 600, windowMs: 10 * MINUTE }],
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

export const locationSendCheck = (userId: string): Check[] => [
  { bucket: "location.send", subject: userId, limits: REQUEST_LIMITS.locationSend },
];

/** 위치 스냅샷(LocationPing) 보관 기간 - 화면은 최신 한 건만 읽는다. */
export const LOCATION_PING_RETENTION_MS = 7 * DAY;

export const billingSessionCheck = (userId: string): Check[] => [
  { bucket: "billing.session", subject: userId, limits: REQUEST_LIMITS.billingSession },
];

export const anyMutationCheck = (userId: string): Check[] => [
  { bucket: "mutation", subject: userId, limits: REQUEST_LIMITS.anyMutation },
];
