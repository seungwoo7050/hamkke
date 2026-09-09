import { TRPCError } from "@trpc/server";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { ChatView } from "../chat-view";

const createCaller = createCallerFactory(appRouter);

// "대화" 탭. 인증·페어링 가드는 layout.tsx가 맡는다 — 레이아웃과 페이지는
// 병렬로 렌더되므로 여기서 가드를 반복하는 대신, 비로그인·미페어링이면
// chat.list(spaceProcedure)가 거절하는 걸 받아 아무것도 그리지 않고 레이아웃의
// redirect에 맡긴다.
export default async function ChatPage() {
  const caller = createCaller(await createTRPCContext());
  const result = await caller.chat.list({}).catch((error: unknown) => {
    if (
      error instanceof TRPCError &&
      (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN")
    ) {
      return null;
    }
    throw error;
  });
  if (!result) return null;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <ChatView initialMessages={result.messages} initialNextCursor={result.nextCursor} />
    </main>
  );
}
