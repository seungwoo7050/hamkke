import { expect, test } from "@playwright/test";
import { cleanup, createPairedCouple } from "./db";

// 12편 폴리시 검증에서 나온 화면 결함(docs/COMMIT_PLAN.md "devlog 검증 중 발견 6").
// 둘 다 브라우저에서만 드러난다 — 하이드레이션 직후의 글자, 다른 스타일시트와의
// 우선순위.

const userIds: string[] = [];

test.afterAll(async () => {
  await cleanup(userIds);
});

// src/i18n/format.ts의 한국어 시각 표기("오후 9:32")와 같은 규칙.
function koTime(epochMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const hour = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  const minute = parts.find((p) => p.type === "minute")!.value;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour < 12 ? "오전" : "오후"} ${h12}:${minute}`;
}

test("서버가 그린 뒤 분이 넘어가도 하이드레이션된 시계는 지금 분을 보여준다", async ({
  browser,
  baseURL,
}) => {
  const [a, b] = await createPairedCouple(["서준", "지우"], {
    locale: "ko",
    timezones: ["Asia/Seoul", "America/New_York"],
  });
  userIds.push(a.userId, b.userId);

  const context = await browser.newContext({ timezoneId: "Asia/Seoul", locale: "ko-KR" });
  await context.addCookies([{ ...a.sessionCookie, url: baseURL! }]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  // 브라우저 시계를 서버보다 정확히 1분 앞에 둔다 — 서버 렌더와 하이드레이션
  // 사이에 분이 넘어간 상황을 매번 재현한다.
  await page.clock.install({ time: Date.now() + 60_000 });
  const serverMinute = koTime(Date.now(), "Asia/Seoul");
  await page.goto("/home", { waitUntil: "networkidle" });

  const scene = page.getByRole("region", { name: "지금 우리" });
  await expect
    .poll(async () => {
      const browserNow = await page.evaluate(() => Date.now());
      return (await scene.innerText()).includes(koTime(browserNow, "Asia/Seoul"));
    })
    .toBe(true);
  expect(await scene.innerText()).not.toContain(serverMinute);
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  await context.close();
});
