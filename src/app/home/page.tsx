import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import { LocationPanel } from "./location-panel";
import { StreakBadge } from "./streak-badge";
import { TimezoneWidget } from "./timezone-widget";
import { TopBar } from "./top-bar";
import { WeatherWidget } from "./weather-widget";

const createCaller = createCallerFactory(appRouter);

// "우리" 탭 — 인증·페어링 가드는 layout.tsx가 맡는다.
export default async function UsPage() {
  const caller = createCaller(await createTRPCContext());
  const timezones = await caller.profile.timezones();
  const weather = await caller.weather.forSpace();

  return (
    <>
      <TopBar>
        <div className="flex items-center gap-2">
          <h1 className="text-foreground text-lg font-semibold tracking-tight">함께</h1>
          <StreakBadge />
        </div>
      </TopBar>
      <main className="flex flex-1 flex-col">
        <TimezoneWidget initialMe={timezones.me} initialPartner={timezones.partner} />
        <WeatherWidget me={weather.me} partner={weather.partner} />
        <LocationPanel />
      </main>
    </>
  );
}
