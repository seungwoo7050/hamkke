"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isPartnerPresent, type PresenceState } from "@/lib/presence";
import { ensureRealtimeAuth, getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spacePresenceChannelName } from "@/lib/supabase/channels";

type TypingHandler = (userId: string) => void;

type ClientChannel = {
  /** 상대가 지금 앱을 보고 있는지. */
  partnerPresent: boolean;
  /** 타이핑 신호를 보낸다(클라이언트가 직접 보내는 유일한 이벤트). */
  sendTyping: () => void;
  /** 타이핑 신호를 받는다. 해제 함수를 돌려준다. */
  listenTyping: (handler: TypingHandler) => () => void;
};

const PresenceContext = createContext<ClientChannel>({
  partnerPresent: false,
  sendTyping: () => {},
  listenTyping: () => () => {},
});

// 현존감(PRD §3.2, 신규 기능 N5) — 상대가 지금 앱을 열어 보고 있는지.
// Supabase Realtime Presence는 DB에 남지 않는 휘발성 상태라 저장하지 않는다.
// 탭이 백그라운드로 가면 스스로 빠져서(untrack) "보고 있다"가 과장되지 않게 한다.
// 이 채널은 클라이언트용이라 타이핑 신호도 여기로 주고받는다 — 메인 채널(realtime-context)은
// 서버만 보내고, private 채널 정책도 멤버의 쓰기를 이 채널에만 허용한다
// (마이그레이션 realtime_topic_policies).
export function PresenceProvider({
  spaceId,
  currentUserId,
  privateChannel,
  children,
}: {
  spaceId: string;
  currentUserId: string;
  privateChannel: boolean;
  children: React.ReactNode;
}) {
  const [partnerPresent, setPartnerPresent] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingHandlers = useRef(new Set<TypingHandler>());

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const trackVisibility = () => {
      if (!channel) return;
      if (document.visibilityState === "visible") void channel.track({ at: Date.now() });
      else void channel.untrack();
    };

    // 토큰을 먼저 넣고 구독한다(private 채널의 첫 입장이 공개 키로 거절되지 않게).
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      const ch = supabase.channel(spacePresenceChannelName(spaceId), {
        config: { presence: { key: currentUserId }, private: privateChannel },
      });
      channel = ch;
      channelRef.current = ch;
      ch.on("presence", { event: "sync" }, () =>
        setPartnerPresent(isPartnerPresent(ch.presenceState() as PresenceState, currentUserId)),
      )
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const userId = (payload as { userId?: string }).userId;
          if (userId) typingHandlers.current.forEach((handler) => handler(userId));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") trackVisibility();
        });
    });
    document.addEventListener("visibilitychange", trackVisibility);

    return () => {
      cancelled = true;
      channelRef.current = null;
      document.removeEventListener("visibilitychange", trackVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId, privateChannel]);

  const [actions] = useState(() => ({
    sendTyping: () => {
      void channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId },
      });
    },
    listenTyping: (handler: TypingHandler) => {
      typingHandlers.current.add(handler);
      return () => {
        typingHandlers.current.delete(handler);
      };
    },
  }));

  return (
    <PresenceContext.Provider value={{ partnerPresent, ...actions }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePartnerPresent() {
  return useContext(PresenceContext).partnerPresent;
}

/** 타이핑 신호 보내기·받기(클라이언트용 채널). */
export function useTypingChannel() {
  const { sendTyping, listenTyping } = useContext(PresenceContext);
  return { sendTyping, listenTyping };
}
