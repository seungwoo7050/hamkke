import { TRPCError } from "@trpc/server";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";

const createCaller = createCallerFactory(appRouter);

// Android 홈 화면 위젯이 부르는 읽기 전용 엔드포인트(Phase 6). 위젯은 앱과 같은
// 프로세스에서 웹뷰의 세션 쿠키(CookieManager)를 그대로 실어 보내므로 별도
// 토큰·비밀값이 없다. tRPC 응답 형식을 네이티브에서 풀지 않도록 평평한 JSON.
export async function GET() {
  try {
    const caller = createCaller(await createTRPCContext());
    const data = await caller.home.widget();
    return Response.json({ status: "ok", ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof TRPCError && (err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN")) {
      const status = err.code === "UNAUTHORIZED" ? "signed-out" : "unpaired";
      return Response.json({ status }, { status: err.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    throw err;
  }
}
