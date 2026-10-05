import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { reportError } from "@/lib/report-error";
import { createTRPCContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    // 입력 검증·권한·요청 제한 같은 예상된 오류는 보내지 않는다 - 서버가 처리하지 못한 것만.
    onError: ({ error, path }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") reportError(`trpc.${path}`)(error.cause ?? error);
    },
  });

export { handler as GET, handler as POST };
