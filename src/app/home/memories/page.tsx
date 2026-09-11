import { AnniversaryTracker } from "../anniversary-tracker";
import { CalendarView } from "../calendar-view";
import { OpenedCapsules, UpcomingCapsules } from "../capsule-notes";
import { CountdownTracker } from "../countdown-tracker";
import { QuestionHistory } from "../daily-question";
import { MeetupTimeline } from "../meetup-timeline";
import { MomentFeed } from "../moment-feed";
import { TopBar } from "../top-bar";
import { MemoriesTabs } from "./memories-tabs";

// "기억" 탭 — 인증·페어링 가드는 layout.tsx가 맡는다.
export default async function MemoriesPage({ searchParams }: PageProps<"/home/memories">) {
  // 상황 카드가 "지나온"(도착한 캡슐)이나 추가 시트(첫날 안내)로 바로 데려올 수 있게.
  const { tab, add } = await searchParams;
  return (
    <>
      <TopBar>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">기억</h1>
      </TopBar>
      <main className="flex flex-1 flex-col">
        <MemoriesTabs
          defaultTab={tab === "past" ? "past" : "upcoming"}
          upcoming={
            <>
              <CountdownTracker openAdd={add === "countdown"} />
              <AnniversaryTracker openAdd={add === "anniversary"} />
              <CalendarView />
              <UpcomingCapsules />
            </>
          }
          past={
            <>
              <MomentFeed />
              <MeetupTimeline />
              <OpenedCapsules />
              <QuestionHistory />
            </>
          }
        />
      </main>
    </>
  );
}
