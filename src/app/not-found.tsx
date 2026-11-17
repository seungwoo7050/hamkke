import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFoundPage");

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Logo className="text-xl" />
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-sm text-sm">{t("description")}</p>
      </div>
      <Button asChild className="w-fit">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}
