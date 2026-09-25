import { describe, expect, it, vi } from "vitest";

// addWatcher가 늦게 끝나는 상황을 만들려고 플러그인을 가짜로 바꾼다.
let finishAddWatcher: (id: string) => void = () => {};
const removeWatcher = vi.fn(async () => {});
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    addWatcher: () => new Promise<string>((resolve) => (finishAddWatcher = resolve)),
    removeWatcher,
  }),
}));

const { startNativeLocationWatch, stopNativeLocationWatch } = await import("./location-native");

describe("startNativeLocationWatch / stopNativeLocationWatch", () => {
  // 화면이 시작 직후 내려가면(개발 모드의 effect 두 번 실행도 같은 순서) 정리 함수가
  // addWatcher보다 먼저 돈다. 늦게 끝난 시작이 멈추지 않는 감시를 남기면 안 된다.
  it("시작이 끝나기 전에 멈추면, 시작이 끝나는 대로 그 감시를 멈춘다", async () => {
    const started = startNativeLocationWatch(
      () => {},
      () => {},
    );
    const stopped = stopNativeLocationWatch();
    finishAddWatcher("watcher-1");
    await Promise.all([started, stopped]);
    expect(removeWatcher).toHaveBeenCalledWith({ id: "watcher-1" });
  });
});
