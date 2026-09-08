/**
 * Realtime 채널 인가 전략: Supabase Auth를 쓰지 않고 Auth.js를 쓰므로,
 * Realtime의 RLS 기반 private 채널(realtime.messages 테이블 정책)을 쓰려면
 * Supabase가 인식하는 커스텀 JWT를 직접 서명해야 하는데 공식 문서에 정확한
 * 방법이 없다. 대신 public 채널 + spaceId(cuid, 추측 불가능)를 채널명에
 * 그대로 실어 "채널명을 아는 것 자체가 권한"인 캡슐화 모델을 쓴다.
 * spaceId는 항상 Auth.js 세션 기반 tRPC(spaceProcedure)를 통해서만 클라이언트에
 * 전달된다 — docs/ARCHITECTURE.md §4/§10 갱신 참고.
 */
export function spaceChannelName(spaceId: string) {
  return `space:${spaceId}`;
}

/**
 * 현존감(Presence, PRD §3.2) 전용 채널. Presence는 채널 생성 시점에
 * config.presence.key를 줘야 해서 Broadcast 채널과 분리했다 — 같은 공개 채널
 * 캡슐화 모델을 따른다.
 */
export function spacePresenceChannelName(spaceId: string) {
  return `space:${spaceId}:presence`;
}
