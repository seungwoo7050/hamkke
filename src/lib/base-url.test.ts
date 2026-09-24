import { describe, expect, it } from "vitest";
import { baseUrlFrom } from "./base-url";

const req = (h: Record<string, string>) => new Headers(h);

describe("baseUrlFrom", () => {
  it("APP_URL이 있으면 요청의 Host와 상관없이 그 주소를 쓴다", () => {
    expect(
      baseUrlFrom(req({ host: "evil.example" }), {
        APP_URL: "https://hamkke.app/",
        NODE_ENV: "production",
      }),
    ).toBe("https://hamkke.app");
  });

  it("개발 서버는 localhost가 아닌 주소(에뮬레이터 10.0.2.2)도 http다", () => {
    expect(baseUrlFrom(req({ host: "10.0.2.2:3000" }), { NODE_ENV: "development" })).toBe(
      "http://10.0.2.2:3000",
    );
    expect(baseUrlFrom(req({ host: "localhost:3000" }), { NODE_ENV: "development" })).toBe(
      "http://localhost:3000",
    );
  });

  it("APP_URL이 없으면 프록시가 알려 준 호스트·프로토콜을 먼저 본다", () => {
    expect(
      baseUrlFrom(
        req({
          host: "internal:3000",
          "x-forwarded-host": "hamkke.app",
          "x-forwarded-proto": "https",
        }),
        {
          NODE_ENV: "production",
        },
      ),
    ).toBe("https://hamkke.app");
  });
});
