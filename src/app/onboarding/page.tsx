import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { SceneIllustration } from "@/components/brand/scene-illustration";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";
import { PairingPanel } from "./pairing-panel";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const status = await getCurrentPairingStatus();
  if (status.status === "active") {
    redirect("/home");
  }
  const t = await getTranslations("onboarding");

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      {/* 아직 이어지지 않은 실 - 밤 그림이 없어 다크 모드에선 살짝 낮춰 화면에 묻힌다. */}
      <div className="w-full max-w-md overflow-hidden rounded-3xl dark:brightness-[0.82]">
        <SceneIllustration scene="apart" sizes="(min-width: 30rem) 28rem, 100vw" priority />
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-sm">{t("description")}</p>
      </div>

      <PairingPanel initialStatus={status} />
    </main>
  );
}
