"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isPartnerPresent, type PresenceState } from "@/lib/presence";
import { ensureRealtimeAuth, getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spacePresenceChannelName } from "@/lib/supabase/channels";

const PresenceContext = createContext(false);

// 현존감(PRD §3.2, 신규 기능 N5) — 상대가 지금 앱을 열어 보고 있는지.
// Supabase Realtime Presence는 DB에 남지 않는 휘발성 상태라 저장하지 않는다.
// 탭이 백그라운드로 가면 스스로 빠져서(untrack) "보고 있다"가 과장되지 않게 한다.
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
      ch.on("presence", { event: "sync" }, () =>
        setPartnerPresent(isPartnerPresent(ch.presenceState() as PresenceState, currentUserId)),
      ).subscribe((status) => {
        if (status === "SUBSCRIBED") trackVisibility();
      });
    });
    document.addEventListener("visibilitychange", trackVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", trackVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId, privateChannel]);

  return <PresenceContext.Provider value={partnerPresent}>{children}</PresenceContext.Provider>;
}

export function usePartnerPresent() {
  return useContext(PresenceContext);
}
