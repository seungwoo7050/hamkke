import "server-only";
import { isPrivateRealtimeEnabled } from "@/server/realtime-token";
import { spaceChannelName } from "./channels";
import { createSupabaseServerClient } from "./server";

/**
 * DB 쓰기(Prisma)가 성공한 뒤 Space 채널로 브로드캐스트한다. secret key라 RLS를
 * 거치지 않고, private 채널로 전환된 뒤(SUPABASE_JWT_PRIVATE_KEY)엔 private 토픽으로
 * 보낸다. 구독 없이 REST(httpSend)로 한 번 보내고 끝난다.
 *
 * 실패해도 던지지 않는다 — 저장은 이미 끝났고, 상대 화면은 다음 조회 때 따라온다
 * (예전 channel.send()의 REST 대체 경로도 실패를 결과값으로만 돌려줬다).
 */
export async function broadcastToSpace(spaceId: string, event: string, payload: object) {
  const supabase = createSupabaseServerClient();
  const channel = supabase.channel(spaceChannelName(spaceId), {
    config: { private: isPrivateRealtimeEnabled() },
  });
  try {
    await channel.httpSend(event, payload);
  } catch (err) {
    console.warn(`[realtime] broadcast ${event} failed`, err);
  } finally {
    await supabase.removeChannel(channel);
  }
}
