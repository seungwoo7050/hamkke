// 요금제 사용량 표시·한도 근처 안내(PRD §3.5)에 쓰는 순수 로직. 한도 숫자
// 자체는 src/lib/plan.ts(server-only)가 소유하고, 이 파일은 클라이언트에서도
// 쓸 수 있는 판정만 둔다.

/** 한도의 이 비율 이상을 쓰면 "곧 한도예요"를 조용히 알려준다. */
export const NEAR_LIMIT_RATIO = 0.8;

export type UsageItem = { used: number; limit: number };

export function isNearLimit({ used, limit }: UsageItem) {
  return used >= Math.ceil(limit * NEAR_LIMIT_RATIO);
}

export function isAtLimit({ used, limit }: UsageItem) {
  return used >= limit;
}
