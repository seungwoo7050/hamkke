"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";

// 홈(/home) 안의 탭·시트에서 예외가 나도 공간 셸 바깥으로 튕기지 않고 바로 다시 시도하게 한다.
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    reportError("home.error")(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Logo className="text-xl" />
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-sm text-sm">{t("description")}</p>
        {error.digest && (
          <p className="text-muted-foreground font-mono text-xs">
            {t("code", { digest: error.digest })}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={reset}>
          {t("retry")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/home">{t("home")}</Link>
        </Button>
      </div>
    </main>
  );
}
