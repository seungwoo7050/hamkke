"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";

// 일반 라우트에서 잡히지 않은 예외가 났을 때 루트 레이아웃 안에서 보여주는 복구 화면.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    reportError("app.error")(error);
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
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </main>
  );
}
