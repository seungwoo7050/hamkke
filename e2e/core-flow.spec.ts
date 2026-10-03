import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { cleanup, countLocationPings, createSignedInUser, spaceOf } from "./db";

// 핵심 플로우: 페어링 → 채팅 → 위치공유 → 구독(docs/COMMIT_PLAN.md Phase 8).
// 두 사람은 서로 다른 브라우저 컨텍스트(서울·뉴욕 시간대/좌표)로 움직인다.
// 실시간(Supabase Realtime)이 없는 환경에서도 돌도록, 상대 화면은 필요한 곳에서
// 다시 열어 서버 상태로 확인한다 - 실시간 경로는 단위·통합 테스트와 수동 두 기기
// 확인이 맡는다(CLAUDE.md 미완료 검증 항목 3).

const SEOUL = { latitude: 37.5665, longitude: 126.978 };
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };

let userIds: string[] = [];

test.afterAll(async () => {
  await cleanup(userIds);
});

async function openAs(
  browser: Browser,
  baseURL: string,
  cookie: { name: string; value: string },
  opts: { timezoneId: string; geolocation: { latitude: number; longitude: number } },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    timezoneId: opts.timezoneId,
    geolocation: opts.geolocation,
    permissions: ["geolocation"],
  });
  await context.addCookies([{ ...cookie, url: baseURL }]);
  return { context, page: await context.newPage() };
}

async function turnOnLocationSharing(page: Page) {
  await page.goto("/home");
  await page.getByRole("button", { name: "설정 열기" }).click();
  const sharing = page.getByRole("dialog").getByRole("switch").first();
  await sharing.click();
  // 켜기 전에 위치기반서비스 약관 동의 시트를 거친다(위치정보법 §19).
  const consent = page.getByRole("dialog", { name: "위치를 나누기 전에" });
  await consent.getByRole("checkbox").click();
  await consent.getByRole("button", { name: "동의하고 켜기" }).click();
  await expect(sharing).toBeChecked();
  await page.keyboard.press("Escape");
}

test("페어링 → 채팅 → 위치공유 → 구독", async ({ browser, baseURL }) => {
  const a = await createSignedInUser("서준");
  const b = await createSignedInUser("지우");
  userIds = [a.userId, b.userId];

  const seoul = await openAs(browser, baseURL!, a.sessionCookie, {
    timezoneId: "Asia/Seoul",
    geolocation: SEOUL,
  });
  const newYork = await openAs(browser, baseURL!, b.sessionCookie, {
    timezoneId: "America/New_York",
    geolocation: NEW_YORK,
  });
  const pa = seoul.page;
  const pb = newYork.page;

  await test.step("페어링: 한 사람이 초대코드를 만들고 다른 사람이 입력한다", async () => {
    // 로그인했지만 아직 연결 전이면 홈 대신 온보딩으로 간다.
    await pa.goto("/home");
    await expect(pa).toHaveURL(/\/onboarding/);
    await pa.getByRole("button", { name: "초대코드 만들기" }).click();
    await expect(pa.getByText("이 코드를 상대에게 공유하세요.")).toBeVisible();
    const code = (await spaceOf(a.userId)).inviteCode;
    await expect(pa.getByText(code, { exact: true })).toBeVisible();

    await pb.goto("/onboarding");
    await pb.getByRole("button", { name: "받은 코드 입력하기" }).click();
    await pb.getByPlaceholder("초대코드 6자리").fill(code);
    await pb.getByRole("button", { name: "연결하기" }).click();
    await expect(pb).toHaveURL(/\/home$/);

    // 코드를 만든 쪽은 대기 화면이 폴링으로 연결을 알아채고 홈으로 넘어간다.
    await expect(pa).toHaveURL(/\/home$/, { timeout: 20_000 });
    await expect(pa.getByRole("region", { name: "지금 우리" })).toContainText("지우");
  });

  await test.step("채팅: 보낸 메시지가 상대 대화 화면에 보인다", async () => {
    const text = `잘 잤어? ${randomBytes(3).toString("hex")}`;
    await pa.getByRole("link", { name: /대화/ }).click();
    await pa.getByPlaceholder("메시지").fill(text);
    await pa.getByRole("button", { name: "보내기", exact: true }).click();
    await expect(pa.getByText(text)).toBeVisible();

    await pb.goto("/home/chat");
    await expect(pb.getByText(text)).toBeVisible();
  });

  await test.step("위치공유: 둘 다 켜면 두 사람 사이 거리가 장면에 보인다", async () => {
    await turnOnLocationSharing(pa);
    await turnOnLocationSharing(pb);
    // 켜는 순간 현재 좌표를 한 번 보낸다 - 두 좌표가 모두 저장될 때까지 기다린다.
    await expect.poll(() => countLocationPings(userIds)).toBeGreaterThanOrEqual(2);

    await pa.goto("/home");
    // 서울–뉴욕 대권거리 약 11,000km
    await expect(pa.getByRole("button", { name: "위치 보기" })).toHaveText(/1[01],\d{3}km/);
  });

  await test.step("구독: 결제 페이지로 가고, 웹훅이 오면 두 사람 모두 프리미엄", async () => {
    const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    test.skip(
      !secretKey.startsWith("sk_test_") || !webhookSecret,
      "Stripe 테스트 모드 키와 웹훅 서명 비밀값이 있어야 해요",
    );

    await pa.getByRole("button", { name: "설정 열기" }).click();
    await expect(pa.getByText("무료 플랜")).toBeVisible();
    await pa.getByRole("button", { name: "프리미엄", exact: true }).click();
    // Stripe가 호스팅하는 결제 페이지 자체는 자동화하지 않는다(Stripe 권장).
    await pa.waitForURL(/checkout\.stripe\.com/, { waitUntil: "commit" });

    // 결제 완료 후 Stripe가 보내는 서명된 웹훅을 서버에 보낸다. 서버는 본문이 아니라
    // Stripe에서 다시 읽은 구독을 쓰므로, 테스트 모드에 실제 구독을 만들어 그 객체를 싣는다.
    const space = await spaceOf(a.userId);
    const stripe = new Stripe(secretKey);
    const customer = await stripe.customers.create({
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID! }],
        metadata: { spaceId: space.id },
      });
      const payload = JSON.stringify({
        id: `evt_e2e_${randomBytes(6).toString("hex")}`,
        object: "event",
        type: "customer.subscription.created",
        data: { object: subscription },
      });
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
      });
      const res = await pa.request.post("/api/webhooks/stripe", {
        data: payload,
        headers: { "content-type": "application/json", "stripe-signature": signature },
      });
      expect(res.ok()).toBe(true);

      // 구독 주체는 스페이스 - 결제하지 않은 상대도 프리미엄이다.
      for (const page of [pa, pb]) {
        await page.goto("/home");
        await page.getByRole("button", { name: "설정 열기" }).click();
        await expect(page.getByText("두 사람 모두 프리미엄 혜택을 받고 있어요")).toBeVisible();
      }
    } finally {
      // 고객을 지우면 그 구독도 함께 해지된다. 결제 페이지로 갈 때 앱이 만든
      // 스페이스 고객도 함께 지운다.
      await stripe.customers.del(customer.id);
      if (space.stripeCustomerId) await stripe.customers.del(space.stripeCustomerId);
    }

    // 결제 페이지로 갈 때 앱이 스페이스용으로 만든 Stripe 고객도 남기지 않는다
    // (테스트 모드라도 실행마다 쌓이지 않게).
    expect(space.stripeCustomerId).toBeTruthy();
    const leftover = await stripe.customers.retrieve(space.stripeCustomerId!);
    expect(leftover.deleted).toBe(true);
  });

  await seoul.context.close();
  await newYork.context.close();
});
