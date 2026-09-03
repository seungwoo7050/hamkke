import "server-only";
import { auth } from "@/auth";
import { getBaseUrl } from "@/lib/base-url";

export async function createTRPCContext() {
  // next/headers는 요청 컨텍스트 밖(Vitest 등)에서 호출하면 에러를 던져서,
  // 라우터가 직접 부르지 않고 여기서 한 번 계산해 넘긴다 — 테스트에서는
  // caller를 만들 때 baseUrl을 원하는 값으로 그냥 채워 넣으면 된다.
  const [session, baseUrl] = await Promise.all([auth(), getBaseUrl()]);
  return { session, baseUrl };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
