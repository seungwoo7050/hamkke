import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { isSensitiveKey, scrubEvent } from "./sentry-scrub";

function event(partial: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...partial } as ErrorEvent;
}

describe("Sentry 개인정보 걸러내기", () => {
  it("사용자는 id만 남긴다(이메일·이름·IP 없음)", () => {
    const out = scrubEvent(
      event({
        user: { id: "u1", email: "a@example.com", username: "서준", ip_address: "1.2.3.4" },
      }),
    );
    expect(out.user).toEqual({ id: "u1" });
  });

  it("요청은 방법·쿼리를 뗀 주소·user-agent만 남긴다", () => {
    const out = scrubEvent(
      event({
        request: {
          method: "POST",
          url: "https://hamkke.app/api/trpc/chat.send?batch=1&input=%7B%22content%22%3A%22hi%22%7D",
          headers: {
            cookie: "authjs.session-token=abc",
            "user-agent": "UA",
            "x-forwarded-for": "1.2.3.4",
          },
          cookies: { "authjs.session-token": "abc" },
          data: { content: "사랑해" },
          query_string: "token=abc",
        },
      }),
    );
    expect(out.request).toEqual({
      method: "POST",
      url: "https://hamkke.app/api/trpc/chat.send",
      headers: { "user-agent": "UA" },
    });
  });

  it("오류 메시지 속 이메일과 주소 쿼리를 가리고, 스택의 지역 변수를 지운다", () => {
    const out = scrubEvent(
      event({
        message: "a@example.com 로그인 실패",
        exception: {
          values: [
            {
              type: "Error",
              value:
                "fetch https://r2.example.com/x.png?X-Amz-Signature=s failed for b@example.com",
              stacktrace: { frames: [{ function: "send", vars: { content: "비밀" } }] },
            },
          ],
        },
      }),
    );
    expect(out.message).toBe("[걸러냄] 로그인 실패");
    expect(out.exception?.values?.[0].value).toBe(
      "fetch https://r2.example.com/x.png failed for [걸러냄]",
    );
    expect(out.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({ function: "send" });
  });

  it("extra·breadcrumb 데이터에서 본문·좌표·토큰 키를 지운다", () => {
    const out = scrubEvent(
      event({
        extra: { lat: 37.5, lng: 127, pushToken: "t", nested: { messageText: "hi", count: 2 } },
        breadcrumbs: [
          {
            category: "fetch",
            data: { url: "https://x.test/a?code=1", method: "GET", status_code: 500 },
          },
        ],
      }),
    );
    expect(out.extra).toEqual({ nested: { count: 2 } });
    expect(out.breadcrumbs?.[0].data).toEqual({
      url: "https://x.test/a",
      method: "GET",
      status_code: 500,
    });
  });

  it("기기 정보(contexts)는 키를 지우지 않는다", () => {
    const out = scrubEvent(
      event({ contexts: { os: { name: "Android" }, browser: { name: "Chrome" } } }),
    );
    expect(out.contexts).toEqual({ os: { name: "Android" }, browser: { name: "Chrome" } });
  });

  it("키 이름은 단어 단위로 본다", () => {
    expect(isSensitiveKey("inviteCode")).toBe(true);
    expect(isSensitiveKey("ip_address")).toBe(true);
    expect(isSensitiveKey("description")).toBe(false);
    expect(isSensitiveKey("status_code")).toBe(false);
  });
});
