"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { useTRPC } from "@/trpc/client";
import { usePartnerName } from "./space-context";

// 설정 시트의 언어 선택(PRD §3.8). 언어 이름은 그 언어로 쓴다("한국어"/"English").
// 바꾸면 서버 렌더를 새로 받고(세션에 실린 언어가 바뀜), 서버가 언어별로 만든
// 캐시(질문 문장·공항 이름 등)도 다시 받는다.
export function LanguageSection() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("settings");
  const locale = useLocale();
  const partnerName = usePartnerName();
  const setLocale = useMutation(
    trpc.profile.setLocale.mutationOptions({
      onSuccess: () => {
        router.refresh();
        void queryClient.invalidateQueries();
      },
      onError: () => toast.error(t("languageFailed")),
    }),
  );

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <Languages className="text-dusk-ink size-5" />
        <div className="flex-1">
          <p className="text-foreground text-base font-medium">{t("language")}</p>
          <p className="text-muted-foreground text-sm">{t("languageSub", { name: partnerName })}</p>
        </div>
      </div>
      <div className="ml-8 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("language")}>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            lang={l}
            aria-checked={locale === l}
            disabled={setLocale.isPending}
            onClick={() => locale !== l && setLocale.mutate({ locale: l })}
            className={cn(
              "border-input duration-base ease-standard h-11 rounded-lg border text-base transition-colors",
              locale === l && "border-primary bg-primary/10 font-semibold",
            )}
          >
            {LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
