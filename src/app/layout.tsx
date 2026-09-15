import type { Metadata } from "next";
import { Gaegu } from "next/font/google";
import { LucideProvider } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "pretendard/dist/web/static/pretendard-dynamic-subset.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TRPCClientProvider } from "@/trpc/client";

// 감성 포인트 전용(DESIGN.md §3.2) — 본문/버튼/내비게이션에는 사용하지 않는다.
const gaegu = Gaegu({
  variable: "--font-handwritten",
  weight: ["400", "700"],
  subsets: ["latin"], // next/font 메타데이터상 라벨은 latin뿐이지만 실제 폰트 파일에 한글 글리프 포함
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // <html lang>은 언어별 폰트 토큰(globals.css :lang())과 스크린 리더 발음의 기준이다.
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${gaegu.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* DESIGN.md §9: 아이콘 stroke-width 1.5 고정 — 아이콘마다 prop을
            반복하지 않고 전역 하나로 강제한다. */}
        <LucideProvider strokeWidth={1.5}>
          <NextIntlClientProvider>
            <TRPCClientProvider>{children}</TRPCClientProvider>
            <Toaster />
          </NextIntlClientProvider>
        </LucideProvider>
      </body>
    </html>
  );
}
