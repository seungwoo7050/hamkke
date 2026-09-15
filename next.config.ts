import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 다국어(ARCHITECTURE.md §12) — 언어는 요청마다 src/i18n/request.ts가 정한다.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // R2 presigned URL(이미지/음성 메시지)만 허용 — 그 외 외부 이미지는 없다.
    remotePatterns: [{ protocol: "https", hostname: "*.r2.cloudflarestorage.com" }],
  },
};

export default withNextIntl(nextConfig);
