import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { BillingSection } from "./billing-section";
import { GeofenceManager } from "./geofence-manager";
import { LocationPanel } from "./location-panel";
import { StreakBadge } from "./streak-badge";
import { TimezoneWidget } from "./timezone-widget";
import { WeatherWidget } from "./weather-widget";

const createCaller = createCallerFactory(appRouter);

// "우리" 탭 — 인증·페어링 가드는 layout.tsx가 맡는다.
export default async function UsPage() {
  const session = (await auth())!;
  const status = await getCurrentPairingStatus();
  if (status.status !== "active") return null;

  const caller = createCaller(await createTRPCContext());
  const mySharing = await caller.location.mySharing();
  const partnerStatus = await caller.location.partnerStatus();
  const timezones = await caller.profile.timezones();
  const weather = await caller.weather.forSpace();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <>
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
      </main>
    </>
  );
}
