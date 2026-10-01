import { defineConfig, devices } from "@playwright/test";

// 핵심 플로우 e2e(docs/COMMIT_PLAN.md Phase 8). 실제 Next.js 서버 + 실제 DB로
// 돈다 - 서버와 이 테스트가 같은 DATABASE_URL을 봐야 한다(e2e/db.ts가 로컬
// DB가 아니면 실행을 거부한다). 이미 떠 있는 dev 서버가 있으면 그대로 쓴다.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "ko-KR",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
  },
  // 구독 시나리오(core-flow)는 유료 플랜이 열려 있어야 한다. 이미 떠 있는 서버를 쓰면
  // 이 env는 닿지 않으니 그 서버를 PREMIUM_OPEN=1로 띄운다(.env.example).
  webServer: {
    command: "npm run dev",
    env: { ...process.env, PREMIUM_OPEN: "1" } as Record<string, string>,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
