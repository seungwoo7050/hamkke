import { auth } from "@/auth";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { ChatView } from "../chat-view";

const createCaller = createCallerFactory(appRouter);

// "대화" 탭 — 인증·페어링 가드는 layout.tsx가 맡는다.
export default async function ChatPage() {
  const session = (await auth())!;
  const status = await getCurrentPairingStatus();
  if (status.status !== "active") return null;

  const caller = createCaller(await createTRPCContext());
  const { messages, nextCursor } = await caller.chat.list({});

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <ChatView
        currentUserId={session.user.id}
        initialMessages={messages}
        initialNextCursor={nextCursor}
      />
    </main>
  );
}
