import { describe, expect, it, vi } from "vitest";

type Listener = (payload: { value: string }) => void;
const listeners = new Map<string, Listener>();
const removed: string[] = [];
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    requestPermissions: async () => ({ receive: "granted" }),
    addListener: async (event: string, fn: Listener) => {
      listeners.set(event, fn);
      return { remove: async () => void removed.push(event) };
    },
    register: async () => listeners.get("registration")?.({ value: "token-1" }),
  },
}));

const { requestNativePushToken } = await import("./push-native");

describe("requestNativePushToken", () => {
  // 부를 때마다 리스너를 붙이고 떼지 않으면, 화면이 다시 열릴 때마다 쌓인다.
  it("토큰을 받으면 이번 요청에 붙인 리스너를 모두 뗀다", async () => {
    expect(await requestNativePushToken()).toBe("token-1");
    expect(removed.sort()).toEqual(["registration", "registrationError"]);
  });
});
