"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { isPartnerPresent, type PresenceState } from "@/lib/presence";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spacePresenceChannelName } from "@/lib/supabase/channels";

const PresenceContext = createContext(false);

// 현존감(PRD §3.2, 신규 기능 N5) — 상대가 지금 앱을 열어 보고 있는지.
// Supabase Realtime Presence는 DB에 남지 않는 휘발성 상태라 저장하지 않는다.
// 탭이 백그라운드로 가면 스스로 빠져서(untrack) "보고 있다"가 과장되지 않게 한다.
export function PresenceProvider({
  spaceId,
  currentUserId,
  children,
}: {
  spaceId: string;
  currentUserId: string;
  children: React.ReactNode;
}) {
  const [partnerPresent, setPartnerPresent] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(spacePresenceChannelName(spaceId), {
      config: { presence: { key: currentUserId } },
    });

    const sync = () =>
      setPartnerPresent(isPartnerPresent(channel.presenceState() as PresenceState, currentUserId));
    const trackVisibility = () => {
      if (document.visibilityState === "visible") void channel.track({ at: Date.now() });
      else void channel.untrack();
    };

    channel.on("presence", { event: "sync" }, sync).subscribe((status) => {
      if (status === "SUBSCRIBED") trackVisibility();
    });
    document.addEventListener("visibilitychange", trackVisibility);

    return () => {
      document.removeEventListener("visibilitychange", trackVisibility);
      void supabase.removeChannel(channel);
    };
  }, [spaceId, currentUserId]);

  return <PresenceContext.Provider value={partnerPresent}>{children}</PresenceContext.Provider>;
}

export function usePartnerPresent() {
  return useContext(PresenceContext);
}
