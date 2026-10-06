import type { Metadata, Viewport } from "next";
import { Gaegu } from "next/font/google";
import { LucideProvider } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "pretendard/dist/web/static/pretendard-dynamic-subset.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TRPCClientProvider } from "@/trpc/client";

// 감성 포인트 전용(DESIGN.md §3.2) - 본문/버튼/내비게이션에는 사용하지 않는다.
const gaegu = Gaegu({
  variable: "--font-handwritten",
  weight: ["400", "700"],
  subsets: ["latin"], // next/font 메타데이터상 라벨은 latin뿐이지만 실제 폰트 파일에 한글 글리프 포함
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("title"),
    description: t("description"),
    // 아이폰 홈 화면에 추가하면 Safari 주소창 없이 열리는 웹 앱으로(manifest.ts와 짝).
    appleWebApp: { capable: true, title: t("shortName"), statusBarStyle: "default" },
    // 둘만 쓰는 비공개 앱이라 어떤 페이지도 검색에 올리지 않는다(정책 문서도 앱 안 링크로만 연다).
    robots: { index: false, follow: false },
  };
}

// 상태 표시줄·브라우저 바 색을 화면 배경(globals.css --background: zinc-50 / zinc-900)에 맞춘다.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // <html lang>은 언어별 폰트 토큰(globals.css :lang())과 스크린 리더 발음의 기준이다.
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${gaegu.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* DESIGN.md §9: 아이콘 stroke-width 1.5 고정 - 아이콘마다 prop을
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
