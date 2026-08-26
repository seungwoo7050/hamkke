"use client";

import { createClient } from "@supabase/supabase-js";

/** 채팅/위치 등 Realtime 구독용. 호출부(컴포넌트)가 라이프사이클을 관리한다. */
export function createSupabaseBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
