import { useTranslations } from "next-intl";
import { ContextCards } from "./context-cards";
import { StreakBadge } from "./streak-badge";
import { TopBar } from "./top-bar";
import { TouchHero } from "./touch-hero";
import { UsScene } from "./us-scene";

// "우리" 탭 - 인증·페어링 가드와 장면 첫 렌더 값(home.summary)은 layout.tsx가
// 맡는다.
export default function UsPage() {
  const t = useTranslations("common");
  return (
    <>
      <TopBar>
        <div className="flex items-center gap-2">
          <h1 className="text-foreground text-lg font-semibold tracking-tight">{t("appName")}</h1>
          <StreakBadge />
        </div>
      </TopBar>
      <main className="flex flex-1 flex-col pb-8">
        <UsScene />
        <TouchHero />
        <ContextCards />
      </main>
    </>
  );
}
