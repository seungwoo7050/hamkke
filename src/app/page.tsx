import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getCurrentPairingStatus } from "@/server/pairing/current-status";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const status = await getCurrentPairingStatus();
    redirect(status.status === "active" ? "/home" : "/onboarding");
  }
  const t = await getTranslations("landing");

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="font-handwritten text-dusk-ink text-lg">{t("tagline")}</p>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">Hamkke</h1>
        <p className="text-muted-foreground max-w-sm">{t("description")}</p>
      </div>
      <Button asChild className="w-fit">
        <Link href="/login">{t("start")}</Link>
      </Button>
    </main>
  );
}
