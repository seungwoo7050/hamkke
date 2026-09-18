import { createTranslator } from "use-intl/core";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "./messages";
import { pseudoMessages, pseudoString } from "./pseudo";

describe("가짜 언어", () => {
  it("글자는 바꾸고 ICU 자리는 그대로, 더 길게", () => {
    expect(pseudoString("Sent to {name}")).toBe("[Šēñŧ ŧō {name}~~~]");
    const t = createTranslator({ locale: "en", messages: pseudoMessages(MESSAGES.en) });
    expect(t("touch.sent", { name: "Jiwoo" })).toContain("Jiwoo");
    expect(t("nav.unread", { label: "Chat", count: 2 })).toMatch(/^\[.*2.*\]$/);
  });

  it("모든 문구가 가짜 언어에서도 ICU 문법을 지킨다", () => {
    const errors: string[] = [];
    const t = createTranslator({
      locale: "en",
      messages: pseudoMessages(MESSAGES.en),
      onError: (e) => errors.push(e.message),
    });
    const walk = (obj: unknown, prefix = ""): void => {
      if (typeof obj === "string") {
        const args = Object.fromEntries([...obj.matchAll(/\{(\w+)/g)].map(([, n]) => [n, 1]));
        (t as unknown as (k: string, a: object) => string)(prefix, args);
        return;
      }
      for (const [k, v] of Object.entries(obj as object)) walk(v, prefix ? `${prefix}.${k}` : k);
    };
    walk(MESSAGES.en);
    expect(errors).toEqual([]);
  });
});
