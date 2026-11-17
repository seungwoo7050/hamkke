"use client";

import { useEffect } from "react";
import { DEFAULT_LOCALE, matchAcceptLanguage } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { reportError } from "@/lib/report-error";

// 루트 레이아웃(src/app/layout.tsx) 자체가 깨졌을 때의 최후 화면.
// NextIntlClientProvider와 전역 스타일시트가 없을 수 있으므로 자체 <html>·<body>와
// 인라인 스타일만 쓰고, 브라우저 언어에 맞는 문구를 MESSAGES에서 직접 고른다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError("app.global-error")(error);
  }, [error]);

  const locale =
    (typeof navigator !== "undefined" ? matchAcceptLanguage(navigator.language) : null) ??
    DEFAULT_LOCALE;
  const copy = MESSAGES[locale].errorPage;

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#fafafa",
          color: "#18181b",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>{copy.title}</h1>
        <p style={{ margin: 0, maxWidth: "320px", fontSize: "14px", color: "#71717a" }}>
          {copy.description}
        </p>
        {error.digest && (
          <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>
            {copy.code.replace("{digest}", error.digest)}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 20px",
            borderRadius: "9999px",
            border: "1px solid #e4e4e7",
            backgroundColor: "#18181b",
            color: "#fafafa",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {copy.retry}
        </button>
      </body>
    </html>
  );
}
