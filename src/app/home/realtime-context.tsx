"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spaceChannelName } from "@/lib/supabase/channels";

type Handler = (payload: unknown) => void;

type SpaceRealtime = {
  /** 이 Space 채널로 브로드캐스트한다(예: 타이핑 신호). */
  send: (event: string, payload: unknown) => void;
  /** 이벤트 핸들러를 등록하고 해제 함수를 돌려준다. */
  listen: (event: string, handler: Handler) => () => void;
  /** 채널 구독이 성립했는지 — 재연결될 때마다 false→true로 바뀐다. */
  connected: boolean;
};

const RealtimeContext = createContext<SpaceRealtime | null>(null);

// Space Broadcast 채널을 앱 전체에서 한 번만 구독하고, 화면들은 이벤트 이름별
// 핸들러만 등록한다. supabase-js는 같은 토픽의 채널을 한 클라이언트에서 하나만
// 두고, 구독이 시작된 채널엔 새 콜백을 붙일 수 없어서(`cannot add callbacks
// after subscribe()`), 컴포넌트마다 채널을 만들던 이전 방식은 공유 클라이언트로
// 옮길 수 없었다.
export function SpaceRealtimeProvider({
  spaceId,
  children,
}: {
  spaceId: string;
  children: React.ReactNode;
}) {
  const handlers = useRef(new Map<string, Set<Handler>>());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(spaceChannelName(spaceId))
      .on("broadcast", { event: "*" }, (msg) => {
        handlers.current.get(msg.event)?.forEach((handler) => handler(msg.payload));
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [spaceId]);

  const [value] = useState<Omit<SpaceRealtime, "connected">>(() => ({
    send: (event, payload) => {
      void channelRef.current?.send({ type: "broadcast", event, payload });
    },
    listen: (event, handler) => {
      const set = handlers.current.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.current.set(event, set);
      return () => set.delete(handler);
    },
  }));

  return (
    <RealtimeContext.Provider value={{ ...value, connected }}>{children}</RealtimeContext.Provider>
  );
}

export function useSpaceRealtime() {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useSpaceRealtime은 SpaceRealtimeProvider 안에서만 쓸 수 있어요");
  return value;
}

/**
 * Space 채널의 특정 Broadcast 이벤트를 받는다. 핸들러는 매 렌더 최신 값을
 * 쓰므로 useCallback으로 감쌀 필요가 없다.
 */
export function useSpaceBroadcast<T>(event: string, handler: (payload: T) => void) {
  const { listen } = useSpaceRealtime();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => listen(event, (payload) => latest.current(payload as T)), [listen, event]);
}
