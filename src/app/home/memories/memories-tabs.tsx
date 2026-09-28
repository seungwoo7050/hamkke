"use client";

import { useTranslations } from "next-intl";
import { Tabs } from "radix-ui";

// 기억 탭 상단 세그먼트 - 장거리 연애의 두 시간축(Stafford & Merolla 2007):
// 기대(다가올)와 기억(지나온). DESIGN.md §4.
export function MemoriesTabs({
  defaultTab,
  upcoming,
  past,
}: {
  defaultTab: "upcoming" | "past";
  upcoming: React.ReactNode;
  past: React.ReactNode;
}) {
  const t = useTranslations("memories");
  return (
    <Tabs.Root defaultValue={defaultTab} className="flex flex-col">
      <Tabs.List
        aria-label={t("tabsLabel")}
        className="bg-muted mx-4 mb-5 grid grid-cols-2 rounded-md p-1"
      >
        {[
          ["upcoming", t("upcoming")],
          ["past", t("past")],
        ].map(([value, label]) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-soft duration-base ease-standard focus-visible:ring-ring/50 rounded-sm py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 data-[state=active]:font-semibold"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="upcoming" className="tab-enter px-4 pb-8 outline-none">
        {upcoming}
      </Tabs.Content>
      <Tabs.Content value="past" className="tab-enter px-4 pb-8 outline-none">
        {past}
      </Tabs.Content>
    </Tabs.Root>
  );
}
