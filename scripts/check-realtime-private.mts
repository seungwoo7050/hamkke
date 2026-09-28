/**
 * Realtime private 채널 전환이 운영에서 제대로 됐는지 한 번에 확인한다
 * (README 배포 체크리스트 — 키 가져오기·마이그레이션·env·"Allow public access" 끄기 뒤).
 *
 * 실행: npx tsx --conditions=react-server scripts/check-realtime-private.mts
 *   (.env의 NEXT_PUBLIC_SUPABASE_URL·PUBLISHABLE_KEY·SECRET_KEY·SUPABASE_JWT_PRIVATE_KEY 사용)
 *
 * DB의 실제 스페이스는 건드리지 않는다 — 정책은 토큰의 space_id와 채널 이름만 보므로
 * 임시 스페이스 ID로 확인한다.
 */
import "dotenv/config";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { spaceChannelName, spacePresenceChannelName } from "../src/lib/supabase/channels";
import { signRealtimeToken } from "../src/server/realtime-token";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

type Result = { check: string; ok: boolean; detail: string };
const results: Result[] = [];

// 앱과 같은 방식: 토큰 콜백을 주고, 입장 전에 토큰을 먼저 넣는다(src/lib/supabase/browser.ts의
// ensureRealtimeAuth). 넣지 않으면 첫 입장이 공개 키로 나가 거절된다.
async function clientWith(token: string | null) {
  const c = createClient(url, publishableKey, token ? { accessToken: async () => token } : {});
  if (token) await c.realtime.setAuth(token);
  return c;
}

function join(channel: RealtimeChannel) {
  return new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve("TIMEOUT"), 10_000);
    channel.subscribe((status, err) => {
      if (["SUBSCRIBED", "CHANNEL_ERROR", "CLOSED", "TIMED_OUT"].includes(status)) {
        clearTimeout(timer);
        resolve(err ? `${status} (${err.message})` : status);
      }
    });
  });
}

/** channel에서 event가 ms 안에 오는지 기다리는 약속. 받기 전에 걸어 둔다. */
function waitFor(channel: RealtimeChannel, event: string, ms = 5_000) {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    channel.on("broadcast", { event }, () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function main() {
  const spaceId = `check-${Date.now()}`;
  const [a, b] = await Promise.all([
    signRealtimeToken("check-a", spaceId),
    signRealtimeToken("check-b", spaceId),
  ]);
  if (!a || !b) {
    console.error("SUPABASE_JWT_PRIVATE_KEY가 비어 있어요 — 전환 전 상태입니다.");
    process.exit(1);
  }
  const [memberA, memberB] = await Promise.all([clientWith(a.token), clientWith(b.token)]);

  // 1) 메인 채널(서버 전용): 두 사람 모두 들어가고, 서버 브로드캐스트를 받는다.
  const mainA = memberA.channel(spaceChannelName(spaceId), { config: { private: true } });
  const mainB = memberB.channel(spaceChannelName(spaceId), { config: { private: true } });
  const touchReceived = waitFor(mainB, "touch", 10_000);
  const fakeReceived = waitFor(mainB, "message");
  const [mainStatusA, mainStatusB] = await Promise.all([join(mainA), join(mainB)]);
  results.push({
    check: "자기 스페이스 메인 채널 입장(첫 시도)",
    ok: mainStatusA === "SUBSCRIBED" && mainStatusB === "SUBSCRIBED",
    detail: `${mainStatusA} / ${mainStatusB}`,
  });

  const server = createClient(url, secretKey, { auth: { persistSession: false } });
  await server
    .channel(spaceChannelName(spaceId), { config: { private: true } })
    .httpSend("touch", { check: true });
  results.push({ check: "서버 브로드캐스트 수신", ok: await touchReceived, detail: "" });

  // 2) 메인 채널에 클라이언트가 보낸 가짜 이벤트는 상대에게 닿지 않아야 한다.
  await mainA.send({ type: "broadcast", event: "message", payload: { fake: true } });
  results.push({
    check: "메인 채널의 가짜 message가 상대에게 닿지 않음",
    ok: !(await fakeReceived),
    detail: "",
  });

  // 3) Presence 채널(클라이언트용): 입장, typing이 상대에게 닿고, Presence에 서로 보인다.
  // 앱(src/app/home/presence-context.tsx)처럼 presence 핸들러를 건 뒤 입장한다 — supabase-js는
  // 핸들러가 있을 때만 presence를 켜고, 없으면 broadcast 입장으로 권한을 확인받는다.
  const presA = memberA
    .channel(spacePresenceChannelName(spaceId), {
      config: { private: true, presence: { key: "check-a" } },
    })
    .on("presence", { event: "sync" }, () => {});
  const presB = memberB
    .channel(spacePresenceChannelName(spaceId), {
      config: { private: true, presence: { key: "check-b" } },
    })
    .on("presence", { event: "sync" }, () => {});
  const typingReceived = waitFor(presB, "typing");
  const [presStatusA, presStatusB] = await Promise.all([join(presA), join(presB)]);
  results.push({
    check: "Presence 채널 입장",
    ok: presStatusA === "SUBSCRIBED" && presStatusB === "SUBSCRIBED",
    detail: `${presStatusA} / ${presStatusB}`,
  });
  await presA.send({ type: "broadcast", event: "typing", payload: { userId: "check-a" } });
  results.push({ check: "typing이 상대에게 닿음", ok: await typingReceived, detail: "" });
  await presA.track({ at: Date.now() });
  await new Promise((r) => setTimeout(r, 2_000));
  const seen = Object.keys(presB.presenceState());
  results.push({
    check: "Presence에 상대가 보임",
    ok: seen.includes("check-a"),
    detail: seen.join(","),
  });

  // 4) 남의 스페이스 채널은 같은 토큰으로 못 들어간다.
  const other = await join(
    memberA.channel(spaceChannelName(`${spaceId}-other`), { config: { private: true } }),
  );
  results.push({
    check: "남의 스페이스 private 채널 거절",
    ok: other.startsWith("CHANNEL_ERROR"),
    detail: other,
  });

  // 5) 계정 없이 공개 키만으로는 private·공개 채널 모두 못 들어간다("Allow public access" 끔).
  const anon = await clientWith(null);
  const anonPrivate = await join(
    anon.channel(spaceChannelName(spaceId), { config: { private: true } }),
  );
  results.push({
    check: "공개 키만으로 private 채널 거절",
    ok: anonPrivate.startsWith("CHANNEL_ERROR"),
    detail: anonPrivate,
  });
  // 공개 채널은 새 클라이언트로 — 앞의 거절로 소켓 상태가 섞이지 않게.
  const anonFresh = await clientWith(null);
  const anonPublic = await join(anonFresh.channel(spaceChannelName(`${spaceId}-public`)));
  results.push({
    check: "공개 채널 자체가 막힘(Allow public access 끔)",
    ok: anonPublic.startsWith("CHANNEL_ERROR"),
    detail: anonPublic,
  });

  await Promise.all([memberA, memberB, anon, anonFresh, server].map((c) => c.removeAllChannels()));

  for (const r of results)
    console.log(`${r.ok ? "✓" : "✗"} ${r.check}${r.detail ? ` — ${r.detail}` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed}개 실패` : "\n전부 통과");
  process.exit(failed ? 1 : 0);
}

void main();
