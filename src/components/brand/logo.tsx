import { useLocale, useTranslations } from "next-intl";
import { cn } from "cn";
import { Wordmark } from "./wordmark";

// 심볼의 보이는 높이 = 글자 높이의 1.6배(DESIGN.md §1.1). Pretendard ExtraBold에서
// "함께"는 0.9em, "Hamkke"는 0.72em 높이라 언어마다 심볼 높이가 다르다.
const SYMBOL_HEIGHT: Record<string, string> = { ko: "h-[1.44em]", en: "h-[1.15em]" };

/**
 * 가로형 로고 - 심볼 + 앱 이름(Pretendard ExtraBold, 자간 -0.035em). 글자 크기는
 * className의 text-* 로 정하고 심볼은 그에 맞춰 커진다. 마스터 SVG는 assets/brand/logo-*.svg.
 */
export function Logo({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  return (
    <span
      className={cn(
        "text-dusk-ink inline-flex items-center gap-[0.32em] font-extrabold tracking-[-0.035em]",
        className,
      )}
    >
      <Wordmark tight className={cn("w-auto", SYMBOL_HEIGHT[locale] ?? SYMBOL_HEIGHT.en)} />
      <span>{t("appName")}</span>
    </span>
  );
}
