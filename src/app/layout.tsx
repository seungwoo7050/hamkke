import type { Metadata } from "next";
import { Gaegu } from "next/font/google";
import { LucideProvider } from "lucide-react";
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

export const metadata: Metadata = {
  title: "Hamkke (함께)",
  description: "장거리 연애 커플을 위한 2인 전용 프라이빗 공간",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${gaegu.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* DESIGN.md §9: 아이콘 stroke-width 1.5 고정 — 아이콘마다 prop을
            반복하지 않고 전역 하나로 강제한다. */}
        <LucideProvider strokeWidth={1.5}>
          <TRPCClientProvider>{children}</TRPCClientProvider>
          <Toaster />
        </LucideProvider>
      </body>
    </html>
  );
}
