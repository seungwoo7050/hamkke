import { signRealtimeToken } from "@/server/realtime-token";
import { router, spaceProcedure } from "../init";

export const realtimeRouter = router({
  // 브라우저의 Supabase 클라이언트가 accessToken 콜백으로 부른다(만료 전에만 새로).
  // 키가 설정되지 않았으면 null — 공개 채널로 동작하는 전환 전 상태.
  token: spaceProcedure.query(({ ctx }) => signRealtimeToken(ctx.session.user.id, ctx.space.id)),
});
