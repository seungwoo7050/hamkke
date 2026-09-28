"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

type IssuedToken = { token: string; expiresAt: number };

// Realtime 토큰(src/server/realtime-token.ts)을 만료 5분 전까지 재사용한다 -
// supabase-js는 연결할 때와 하트비트(약 25초)마다 accessToken 콜백을 부른다.
const REFRESH_BEFORE_MS = 5 * 60_000;
let cached: IssuedToken | null = null;
let publicMode = false;
let inflight: Promise<IssuedToken | null> | null = null;

async function fetchRealtimeToken(): Promise<IssuedToken | null> {
  const res = await fetch("/api/trpc/realtime.token", { cache: "no-store" });
  if (!res.ok) throw new Error(`realtime token ${res.status}`);
  const body = (await res.json()) as { result?: { data?: { json?: IssuedToken | null } } };
  return body.result?.data?.json ?? null;
}

async function realtimeAccessToken(): Promise<string> {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  // 서버에 키가 없으면(전환 전) 공개 채널이라 기본값(publishable key)을 쓰고 더 묻지 않는다.
  if (publicMode) return publishableKey;
  if (cached && cached.expiresAt - Date.now() > REFRESH_BEFORE_MS) return cached.token;

  try {
    inflight ??= fetchRealtimeToken().finally(() => {
      inflight = null;
    });
    const fresh = await inflight;
    if (!fresh) {
      publicMode = true;
      return publishableKey;
    }
    cached = fresh;
    return fresh.token;
  } catch {
    // 잠깐의 네트워크 실패면 아직 유효한 토큰을 계속 쓴다.
    return cached && cached.expiresAt > Date.now() ? cached.token : publishableKey;
  }
}

/**
 * 브라우저 전체에서 하나만 쓰는 Supabase 클라이언트(Realtime 구독용).
 * 컴포넌트마다 새로 만들면 WebSocket이 여러 벌 생기고 같은 토픽 채널을 두 번
 * 구독할 수도 없다 - 채널 공유는 src/app/home/realtime-context.tsx가 맡는다.
 * 인증은 Supabase Auth가 아니라 우리 서버가 서명한 스페이스 토큰(accessToken)이다.
 */
export function getSupabaseBrowserClient() {
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { accessToken: realtimeAccessToken },
  );
  return client;
}

let authReady: Promise<void> | null = null;

/**
 * 채널을 구독하기 전에 기다린다. private 채널은 입장할 때 토큰을 보는데, supabase-js는
 * accessToken 콜백을 첫 입장 전에 부르지 않아 첫 입장이 공개 키로 나가 거절되고 몇 초 뒤
 * 재시도에서야 들어갔다. 공개 채널 모드에서는 콜백이 공개 키를 돌려주므로 그대로 통과한다.
 */
export function ensureRealtimeAuth() {
  authReady ??= getSupabaseBrowserClient()
    .realtime.setAuth()
    .catch(() => {
      // 실패하면 다음 구독 때 다시 시도한다(그사이엔 supabase-js의 재시도에 맡긴다).
      authReady = null;
    });
  return authReady;
}
