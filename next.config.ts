import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // R2 presigned URL(이미지/음성 메시지)만 허용 — 그 외 외부 이미지는 없다.
    remotePatterns: [{ protocol: "https", hostname: "*.r2.cloudflarestorage.com" }],
  },
};

export default nextConfig;
