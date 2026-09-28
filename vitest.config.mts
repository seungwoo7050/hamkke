import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    // "server-only" 패키지는 Next.js 번들러가 세팅하는 "react-server" export
    // 조건에서만 no-op이 된다 - Vitest는 테스트를 SSR 파이프라인으로 실행하므로
    // ssr.resolve 쪽에 조건을 줘야 실제로 적용된다.
  },
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
  },
});
