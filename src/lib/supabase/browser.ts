"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * 브라우저 전체에서 하나만 쓰는 Supabase 클라이언트(Realtime 구독용).
 * 컴포넌트마다 새로 만들면 WebSocket과 GoTrueClient가 여러 벌 생기고
 * ("Multiple GoTrueClient instances" 경고), 같은 토픽 채널을 두 번 구독할
 * 수도 없다 — 채널 공유는 src/app/home/realtime-context.tsx가 맡는다.
 */
export function getSupabaseBrowserClient() {
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return client;
}
