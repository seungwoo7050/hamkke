import { expect, test, type Page } from "@playwright/test";
import { cleanup, createPairedCouple } from "./db";

// 영어 화면 e2e(ARCHITECTURE.md §12 품질 게이트). 영어를 고른 커플의 화면에 한국어가
// 한 글자도 나오지 않아야 한다 — 이름도 영어로 만들어 사람이 쓴 글과 섞이지 않게.
// 가짜 언어(개발 서버 전용 쿠키)로 한 번 더 돌면, 문구 파일을 거치지 않은 문장은
// 대괄호·악센트 없이 그대로 보여 눈에 띈다(스크린샷은 테스트 결과에 첨부).

const HANGUL = /[가-힣]/;
let userIds: string[] = [];

test.afterAll(async () => {
  await cleanup(userIds);
});

// 다른 언어라고 lang으로 표시한 요소(언어 선택의 "한국어")는 의도된 것이라 뺀다.
async function visibleText(page: Page) {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[lang]:not([lang^='en'])").forEach((el) => el.remove());
    document.body.appendChild(clone);
    clone.style.position = "absolute";
    const text = clone.innerText;
    clone.remove();
    return text;
  });
}

const SCREENS: { path: string; action?: (page: Page) => Promise<void> }[] = [
  { path: "/home" },
  { path: "/home/chat" },
  { path: "/home/memories" },
  { path: "/home/memories?tab=past" },
  {
    path: "/home",
    action: async (page) => {
      await page.getByRole("button", { name: /settings|šēŧŧîñĝš/i }).click();
      await page.waitForTimeout(600);
    },
  },
];

test("영어를 고른 사람의 화면엔 한국어가 없다(일반·가짜 언어)", async ({
  browser,
  baseURL,
}, info) => {
  const [a, b] = await createPairedCouple(["Alex", "Sam"], {
    locale: "en",
    timezones: ["America/New_York", "Europe/London"],
  });
  userIds = [a.userId, b.userId];

  for (const pseudo of [false, true]) {
    // 브라우저 언어는 한국어 — 사용자가 고른 언어(User.locale)가 이겨야 한다.
    const context = await browser.newContext({ locale: "ko-KR", timezoneId: "America/New_York" });
    await context.addCookies([
      { ...a.sessionCookie, url: baseURL! },
      ...(pseudo ? [{ name: "hamkke-pseudo", value: "1", url: baseURL! }] : []),
    ]);
    const page = await context.newPage();

    for (const [i, screen] of SCREENS.entries()) {
      await page.goto(screen.path);
      await page.waitForLoadState("networkidle");
      await screen.action?.(page);
      const text = await visibleText(page);
      expect(text.match(new RegExp(HANGUL.source, "g")) ?? [], `${screen.path}`).toEqual([]);
      await info.attach(`${pseudo ? "pseudo" : "en"}-${i}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }

    await page.keyboard.press("Escape"); // 설정 시트가 열려 있으면 나머지가 가려진다
    const nav = await page.getByRole("navigation").innerText();
    if (pseudo) expect(nav).toContain("[Ūš");
    else expect(nav).toContain("Us");
    await context.close();
  }
});
