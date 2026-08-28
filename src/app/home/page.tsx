import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { ChatView } from "./chat-view";
import { LocationShareToggle } from "./location-toggle";

const createCaller = createCallerFactory(appRouter);

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const status = await getCurrentPairingStatus();
  if (status.status !== "active") {
    redirect("/onboarding");
  }

  const caller = createCaller(await createTRPCContext());
  const { messages, nextCursor } = await caller.chat.list({});
  const mySharing = await caller.location.mySharing();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-foreground text-lg font-semibold tracking-tight">Hamkke</h1>
        <div className="flex items-center gap-2">
          <LocationShareToggle initialSharing={mySharing} />
          <form action={handleSignOut}>
            <Button type="submit" variant="ghost" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </header>
      <ChatView
        spaceId={status.spaceId}
        currentUserId={session.user.id}
        initialMessages={messages}
        initialNextCursor={nextCursor}
      />
    </div>
  );
}
