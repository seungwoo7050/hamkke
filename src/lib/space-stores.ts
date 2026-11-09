import { createStore } from "zustand/vanilla";

export type BroadcastHandler = (payload: unknown) => void;
export type TypingHandler = (userId: string) => void;
export type Point = { lat: number; lng: number };

export type PartnerLocationPoint = {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  capturedAt: Date;
};

export type LocationBroadcastPayload = Omit<PartnerLocationPoint, "capturedAt"> & {
  capturedAt: string;
};

export type RealtimeStoreState = {
  connected: boolean;
  setConnected: (connected: boolean) => void;
  listen: (event: string, handler: BroadcastHandler) => () => void;
  dispatch: (event: string, payload: unknown) => void;
};

/** Space Broadcast 채널의 연결 상태와 이벤트별 구독자 맵을 관리하는 Zustand 스토어. */
export function createRealtimeStore() {
  const handlers = new Map<string, Set<BroadcastHandler>>();
  return createStore<RealtimeStoreState>((set) => ({
    connected: false,
    setConnected: (connected) => set({ connected }),
    listen: (event, handler) => {
      const group = handlers.get(event) ?? new Set<BroadcastHandler>();
      group.add(handler);
      handlers.set(event, group);
      return () => {
        group.delete(handler);
      };
    },
    dispatch: (event, payload) => {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },
  }));
}

export type PresenceStoreState = {
  partnerPresent: boolean;
  setPartnerPresent: (partnerPresent: boolean) => void;
  listenTyping: (handler: TypingHandler) => () => void;
  notifyTyping: (userId?: string) => void;
};

/** 상대 현존감(Presence)과 타이핑 신호 구독자를 관리하는 Zustand 스토어. */
export function createPresenceStore() {
  const typingHandlers = new Set<TypingHandler>();
  return createStore<PresenceStoreState>((set) => ({
    partnerPresent: false,
    setPartnerPresent: (partnerPresent) => set({ partnerPresent }),
    listenTyping: (handler) => {
      typingHandlers.add(handler);
      return () => {
        typingHandlers.delete(handler);
      };
    },
    notifyTyping: (userId) => {
      if (!userId) return;
      typingHandlers.forEach((handler) => handler(userId));
    },
  }));
}

export type LocationStoreState = {
  sharing: boolean;
  me: Point | null;
  partnerSharing: boolean;
  partnerLocation: PartnerLocationPoint | null;
  consentOpen: boolean;
  setMe: (me: Point | null) => void;
  setConsentOpen: (consentOpen: boolean) => void;
  enableSharing: () => void;
  disableSharing: () => void;
  receivePartnerLocation: (payload: LocationBroadcastPayload) => void;
  receivePartnerSharing: (enabled: boolean) => void;
};

/** 내 위치공유 상태·좌표와 상대의 실시간 위치 상태를 관리하는 Zustand 스토어. */
export function createLocationStore(initial: {
  sharing: boolean;
  partnerSharing: boolean;
  partnerLocation: PartnerLocationPoint | null;
}) {
  return createStore<LocationStoreState>((set) => ({
    sharing: initial.sharing,
    me: null,
    partnerSharing: initial.partnerSharing,
    partnerLocation: initial.partnerLocation,
    consentOpen: false,
    setMe: (me) => set({ me }),
    setConsentOpen: (consentOpen) => set({ consentOpen }),
    enableSharing: () => set({ sharing: true, consentOpen: false }),
    disableSharing: () => set({ sharing: false, me: null }),
    receivePartnerLocation: (payload) =>
      set({
        partnerSharing: true,
        partnerLocation: { ...payload, capturedAt: new Date(payload.capturedAt) },
      }),
    receivePartnerSharing: (enabled) =>
      set((s) => ({
        partnerSharing: enabled,
        partnerLocation: enabled ? s.partnerLocation : null,
      })),
  }));
}
