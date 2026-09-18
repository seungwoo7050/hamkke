import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Wordmark } from "@/components/brand/wordmark";
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
      <Wordmark className="mx-auto" />
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-sm">{t("description")}</p>
      </div>

      <PairingPanel initialStatus={status} />
    </main>
  );
}
