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

function clientWith(token: string | null) {
  return createClient(url, publishableKey, token ? { accessToken: async () => token } : {});
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

async function main() {
  const spaceId = `check-${Date.now()}`;
  const issued = await signRealtimeToken("check-user", spaceId);
  if (!issued) {
    console.error("SUPABASE_JWT_PRIVATE_KEY가 비어 있어요 — 전환 전 상태입니다.");
    process.exit(1);
  }

  // 1) 우리 토큰으로 자기 스페이스 private 채널에 들어가 서버 브로드캐스트를 받는다.
  const member = clientWith(issued.token);
  const own = member.channel(spaceChannelName(spaceId), {
    config: { private: true, broadcast: { ack: true } },
  });
  const received = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 10_000);
    own.on("broadcast", { event: "touch" }, () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  const ownStatus = await join(own);
  results.push({
    check: "자기 스페이스 private 채널 입장",
    ok: ownStatus === "SUBSCRIBED",
    detail: ownStatus,
  });

  const server = createClient(url, secretKey, { auth: { persistSession: false } });
  await server
    .channel(spaceChannelName(spaceId), { config: { private: true } })
    .httpSend("touch", { check: true });
  results.push({ check: "서버 브로드캐스트 수신", ok: await received, detail: "" });

  // 2) 클라이언트가 보낼 수 있는 건 typing뿐 — 가짜 message 이벤트는 거절돼야 한다.
  //    입장하지 못했으면 send가 REST로 빠져 의미가 없으니 건너뛴다.
  if (ownStatus === "SUBSCRIBED") {
    const typing = await own.send({ type: "broadcast", event: "typing", payload: {} });
    const fake = await own.send({ type: "broadcast", event: "message", payload: {} });
    results.push({ check: "typing 전송 허용", ok: typing === "ok", detail: String(typing) });
    results.push({ check: "가짜 message 전송 거절", ok: fake !== "ok", detail: String(fake) });
  } else {
    results.push({ check: "typing·가짜 message 전송", ok: false, detail: "입장 실패로 건너뜀" });
  }

  // 3) Presence 채널
  const presence = member.channel(spacePresenceChannelName(spaceId), {
    config: { private: true, presence: { key: "check-user" } },
  });
  const presenceStatus = await join(presence);
  results.push({
    check: "Presence 채널 입장",
    ok: presenceStatus === "SUBSCRIBED",
    detail: presenceStatus,
  });

  // 4) 남의 스페이스 채널은 같은 토큰으로 못 들어간다.
  const other = await join(
    member.channel(spaceChannelName(`${spaceId}-other`), { config: { private: true } }),
  );
  results.push({
    check: "남의 스페이스 private 채널 거절",
    ok: other.startsWith("CHANNEL_ERROR"),
    detail: other,
  });

  // 5) 계정 없이 공개 키만으로는 private·공개 채널 모두 못 들어간다("Allow public access" 끔).
  const anon = clientWith(null);
  const anonPrivate = await join(
    anon.channel(spaceChannelName(spaceId), { config: { private: true } }),
  );
  results.push({
    check: "공개 키만으로 private 채널 거절",
    ok: anonPrivate.startsWith("CHANNEL_ERROR"),
    detail: anonPrivate,
  });
  // 공개 채널은 새 클라이언트로 — 앞의 거절로 소켓 상태가 섞이지 않게.
  const anonFresh = clientWith(null);
  const anonPublic = await join(anonFresh.channel(spaceChannelName(`${spaceId}-public`)));
  results.push({
    check: "공개 채널 자체가 막힘(Allow public access 끔)",
    ok: anonPublic.startsWith("CHANNEL_ERROR"),
    detail: anonPublic,
  });

  await Promise.all([
    member.removeAllChannels(),
    anon.removeAllChannels(),
    server.removeAllChannels(),
  ]);

  for (const r of results)
    console.log(`${r.ok ? "✓" : "✗"} ${r.check}${r.detail ? ` — ${r.detail}` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed}개 실패` : "\n전부 통과");
  process.exit(failed ? 1 : 0);
}

void main();
