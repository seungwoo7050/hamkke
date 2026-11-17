import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// 다국어(ARCHITECTURE.md §12) - 언어는 요청마다 src/i18n/request.ts가 정한다.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // R2 presigned URL(이미지/음성 메시지)만 허용 - 그 외 외부 이미지는 없다.
    remotePatterns: [{ protocol: "https", hostname: "*.r2.cloudflarestorage.com" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 탑승권 바코드 스캔(camera), 음성 메시지(microphone), 위치 공유(geolocation)는
          // 자기 출처(self)에서만 허용하고 외부 프레임에는 닫는다.
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
