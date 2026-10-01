import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { LatinWordmark } from "@/components/brand/latin-wordmark";
import { SceneIllustration } from "@/components/brand/scene-illustration";
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
      <div className="w-full max-w-md overflow-hidden rounded-3xl">
        <SceneIllustration scene="together" sizes="(min-width: 30rem) 28rem, 100vw" priority />
      </div>
      <div className="flex flex-col gap-3">
        <p className="font-handwritten text-dusk-ink relative w-fit pb-2.5 text-lg">
          {t("tagline")}
          {/* 손으로 그은 밑줄이 끝에서 실의 하트 고리가 된다(연결된 순간의 실과 같은 모양). */}
          <svg
            viewBox="0 0 180 16"
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 w-full"
          >
            <path
              d="M2 11C40 13 96 9 150 12C143.6 7.6 144.8 2 150 5.2C155.2 2 156.4 7.6 150 12C158 13.4 168 12.4 177 10"
              fill="none"
              stroke="var(--color-ember)"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </p>
        <h1 className="text-dusk-ink">
          <LatinWordmark className="h-9" />
          <span className="sr-only">Hamkke</span>
        </h1>
        <p className="text-muted-foreground max-w-sm">{t("description")}</p>
      </div>
      <Button asChild className="w-fit">
        <Link href="/login">{t("start")}</Link>
      </Button>
    </main>
  );
}
