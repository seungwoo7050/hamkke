import "server-only";

/**
 * Phase 1 auth 커밋에서 Auth.js 세션을 여기에 추가한다. 지금은 최소 컨텍스트만
 * 제공(순환 의존 방지 — auth.ts는 이 다음 커밋에서 생긴다).
 */
export async function createTRPCContext() {
  return {};
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
