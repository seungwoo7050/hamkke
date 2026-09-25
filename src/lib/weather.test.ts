import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWeather } from "./weather";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWeather", () => {
  // 날씨 서버가 응답하지 않으면 공통 레이아웃이 기다리는 장면 쿼리 전체가 멈춘다.
  // 거절(4xx·5xx)뿐 아니라 무응답도 짧게 끊겨야 호출하는 쪽의 .catch(() => null)이 받는다.
  it("응답이 오지 않으면 시간 제한 안에 실패한다", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: URL, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );

    const started = Date.now();
    await expect(fetchWeather(37.5665, 126.978, { timeoutMs: 50 })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
