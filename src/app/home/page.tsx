import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { AnniversaryTracker } from "./anniversary-tracker";
import { BillingSection } from "./billing-section";
import { CalendarView } from "./calendar-view";
import { CapsuleNotes } from "./capsule-notes";
import { ChatView } from "./chat-view";
import { CountdownTracker } from "./countdown-tracker";
import { GeofenceManager } from "./geofence-manager";
import { LocationPanel } from "./location-panel";
import { MeetupTimeline } from "./meetup-timeline";
import { MomentFeed } from "./moment-feed";
import { StreakBadge } from "./streak-badge";
import { TimezoneWidget } from "./timezone-widget";
import { WeatherWidget } from "./weather-widget";

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
  const partnerStatus = await caller.location.partnerStatus();
  const timezones = await caller.profile.timezones();
  const weather = await caller.weather.forSpace();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-foreground text-lg font-semibold tracking-tight">Hamkke</h1>
          <StreakBadge />
        </div>
        <form action={handleSignOut}>
          <Button type="submit" variant="ghost" size="sm">
            로그아웃
          </Button>
        </form>
      </header>
      <main className="flex flex-1 flex-col">
        <BillingSection />
        <TimezoneWidget initialMe={timezones.me} initialPartner={timezones.partner} />
        <WeatherWidget me={weather.me} partner={weather.partner} />
        <LocationPanel
          spaceId={status.spaceId}
          currentUserId={session.user.id}
          initialSharing={mySharing}
          initialPartnerStatus={partnerStatus}
        />
        <GeofenceManager />
        <MeetupTimeline />
        <CalendarView />
        <AnniversaryTracker />
        <CountdownTracker />
        <MomentFeed currentUserId={session.user.id} />
        <CapsuleNotes currentUserId={session.user.id} />
        <ChatView
          spaceId={status.spaceId}
          currentUserId={session.user.id}
          initialMessages={messages}
          initialNextCursor={nextCursor}
        />
      </main>
    </div>
  );
}
