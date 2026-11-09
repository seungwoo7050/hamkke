import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocationStore, createPresenceStore, createRealtimeStore } from "./space-stores";
import { markCapsuleUnsealed, unsealedCapsulesStore } from "./unsealed-capsules";

afterEach(() => {
  vi.unstubAllGlobals();
  unsealedCapsulesStore.getState().reset();
});

describe("unsealedCapsulesStore", () => {
  it("열어본 캡슐 ID를 Zustand 스토어와 localStorage에 함께 기록한다", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
      },
    });

    expect(unsealedCapsulesStore.getState().read().has("cap-1")).toBe(false);
    markCapsuleUnsealed("cap-1");
    expect(unsealedCapsulesStore.getState().read().has("cap-1")).toBe(true);
    expect(JSON.parse(storage.get("hamkke:unsealed-capsules") ?? "[]")).toEqual(["cap-1"]);
  });
});

describe("createRealtimeStore / createPresenceStore", () => {
  it("이벤트별 구독자에게만 브로드캐스트를 전달하고 해제하면 멈춘다", () => {
    const store = createRealtimeStore();
    const received: unknown[] = [];
    const off = store.getState().listen("chat", (p) => received.push(p));

    store.getState().dispatch("chat", { id: 1 });
    store.getState().dispatch("touch", { id: 2 });
    off();
    store.getState().dispatch("chat", { id: 3 });

    expect(received).toEqual([{ id: 1 }]);
  });

  it("타이핑 알림은 userId가 있을 때만 구독자에게 전달한다", () => {
    const store = createPresenceStore();
    const users: string[] = [];
    const off = store.getState().listenTyping((u) => users.push(u));

    store.getState().notifyTyping(undefined);
    store.getState().notifyTyping("user-b");
    off();
    store.getState().notifyTyping("user-c");

    expect(users).toEqual(["user-b"]);
  });
});

describe("createLocationStore", () => {
  it("내 위치공유 활성·비활성 및 상대 위치 브로드캐스트 전이를 처리한다", () => {
    const store = createLocationStore({
      sharing: false,
      partnerSharing: false,
      partnerLocation: null,
    });

    store.getState().setConsentOpen(true);
    expect(store.getState().consentOpen).toBe(true);

    store.getState().enableSharing();
    store.getState().setMe({ lat: 37.5665, lng: 126.978 });
    expect(store.getState().sharing).toBe(true);
    expect(store.getState().consentOpen).toBe(false);

    store.getState().receivePartnerLocation({
      id: "ping-1",
      userId: "partner-1",
      lat: 40.7128,
      lng: -74.006,
      accuracy: 12,
      capturedAt: "2026-10-04T12:00:00.000Z",
    });
    expect(store.getState().partnerSharing).toBe(true);
    expect(store.getState().partnerLocation?.lat).toBe(40.7128);

    store.getState().receivePartnerSharing(false);
    expect(store.getState().partnerSharing).toBe(false);
    expect(store.getState().partnerLocation).toBeNull();

    store.getState().disableSharing();
    expect(store.getState().sharing).toBe(false);
    expect(store.getState().me).toBeNull();
  });
});
