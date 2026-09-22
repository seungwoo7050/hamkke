/**
 * Space의 Broadcast 채널 이름. 권한은 채널 이름이 아니라 private 채널 + RLS가
 * 정한다 — 서버가 서명한 스페이스 토큰의 space_id와 이 이름이 맞을 때만 받고
 * 보낼 수 있다(docs/ARCHITECTURE.md §4, 마이그레이션 realtime_space_policies).
 * 이름을 바꾸면 그 정책도 같이 바꿔야 한다.
 */
export function spaceChannelName(spaceId: string) {
  return `space:${spaceId}`;
}

/**
 * 현존감(Presence, PRD §3.2) 전용 채널. Presence는 채널 생성 시점에
 * config.presence.key를 줘야 해서 Broadcast 채널과 분리했다 — 같은
 * 권한 모델을 따른다(정책의 ':presence' 접미사).
 */
export function spacePresenceChannelName(spaceId: string) {
  return `space:${spaceId}:presence`;
}
