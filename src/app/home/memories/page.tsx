import { AnniversaryTracker } from "../anniversary-tracker";
import { CalendarView } from "../calendar-view";
import { OpenedCapsules, UpcomingCapsules } from "../capsule-notes";
import { CountdownTracker } from "../countdown-tracker";
import { MeetupTimeline } from "../meetup-timeline";
import { MomentFeed } from "../moment-feed";
import { TopBar } from "../top-bar";
import { MemoriesTabs } from "./memories-tabs";

// "기억" 탭 — 인증·페어링 가드는 layout.tsx가 맡는다.
export default function MemoriesPage() {
  return (
    <>
      <TopBar>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">기억</h1>
      </TopBar>
      <main className="flex flex-1 flex-col">
        <MemoriesTabs
          upcoming={
            <>
              <CountdownTracker />
              <AnniversaryTracker />
              <CalendarView />
              <UpcomingCapsules />
            </>
          }
          past={
            <>
              <MomentFeed />
              <MeetupTimeline />
              <OpenedCapsules />
            </>
          }
        />
      </main>
    </>
  );
}
